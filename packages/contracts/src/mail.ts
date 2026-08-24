import { z } from 'zod';

import { entityIdSchema, isoDateTimeSchema } from './common.js';
import { createPaginatedResponseSchema, paginationQuerySchema } from './pagination.js';

export const mailDeliveryStatusSchema = z.enum(['queued', 'sent', 'failed']);
export const mailTemplateSchema = z.enum([
  'email-verification',
  'password-reset',
  'admin-invite',
  'test',
]);

export const mailDeliverySchema = z.object({
  id: entityIdSchema,
  jobId: entityIdSchema.nullable(),
  recipient: z.string().min(1).max(320),
  template: mailTemplateSchema,
  subject: z.string().min(1).max(300),
  status: mailDeliveryStatusSchema,
  simulated: z.boolean(),
  lastError: z.string().nullable(),
  sentAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const mailDeliveryQuerySchema = paginationQuerySchema.extend({
  status: mailDeliveryStatusSchema.optional(),
});
export const mailDeliveryListResponseSchema = createPaginatedResponseSchema(mailDeliverySchema);

export const sendTestMailRequestSchema = z.object({
  to: z.string().trim().toLowerCase().pipe(z.email().max(320)),
});
export const queuedMailResponseSchema = z.object({ delivery: mailDeliverySchema });

export type MailDeliveryStatus = z.infer<typeof mailDeliveryStatusSchema>;
export type MailTemplate = z.infer<typeof mailTemplateSchema>;
export type MailDelivery = z.infer<typeof mailDeliverySchema>;
export type MailDeliveryQuery = z.output<typeof mailDeliveryQuerySchema>;
export type SendTestMailRequest = z.output<typeof sendTestMailRequestSchema>;
