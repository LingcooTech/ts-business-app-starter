import { z } from 'zod';

import { requestIdSchema } from './common.js';

export const apiErrorSchema = z.object({
  code: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1),
  details: z.unknown().optional(),
  requestId: requestIdSchema,
});

export const apiErrorResponseSchema = z.object({
  error: apiErrorSchema,
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
