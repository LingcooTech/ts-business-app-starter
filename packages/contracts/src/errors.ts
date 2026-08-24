import {
  isApiErrorResponse,
  type ApiErrorPayload,
  type ApiErrorResponse as PublicApiErrorResponse,
} from '@lingcoo-tech/http';
import { z } from 'zod';

import { requestIdSchema } from './common.js';

export type ApiError = ApiErrorPayload & { requestId: string };
export type ApiErrorResponse = PublicApiErrorResponse & { error: ApiError };

const applicationErrorFieldsSchema = z.object({
  code: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1),
  requestId: requestIdSchema,
});

export const apiErrorSchema = z
  .custom<ApiErrorPayload>(
    (value) => isApiErrorResponse({ error: value }),
    'Invalid @lingcoo-tech/http error payload',
  )
  .transform((value, context): ApiError => {
    const fields = applicationErrorFieldsSchema.safeParse(value);
    if (!fields.success) {
      context.addIssue({
        code: 'custom',
        message: 'Error code, message and request ID must satisfy the application contract',
      });
      return z.NEVER;
    }
    return { ...value, ...fields.data };
  });

export const apiErrorResponseSchema = z
  .custom<PublicApiErrorResponse>(isApiErrorResponse, 'Invalid @lingcoo-tech/http error response')
  .transform((value, context): ApiErrorResponse => {
    const error = apiErrorSchema.safeParse(value.error);
    if (!error.success) {
      context.addIssue({
        code: 'custom',
        path: ['error'],
        message: 'Invalid application error payload',
      });
      return z.NEVER;
    }
    return { error: error.data };
  });
