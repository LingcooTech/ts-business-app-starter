import { z } from 'zod';

import { entityIdSchema, isoDateTimeSchema } from './common.js';
import { createPaginatedResponseSchema, paginationQuerySchema } from './pagination.js';

export const outboxStatusSchema = z.enum(['pending', 'processing', 'published', 'dead']);

export const outboxEventSchema = z.object({
  id: entityIdSchema,
  topic: z.string().min(1).max(120),
  aggregateType: z.string().nullable(),
  aggregateId: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  status: outboxStatusSchema,
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  availableAt: isoDateTimeSchema,
  lockedBy: z.string().nullable(),
  lockedAt: isoDateTimeSchema.nullable(),
  dedupeKey: z.string().nullable(),
  lastError: z.string().nullable(),
  publishedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const outboxQuerySchema = paginationQuerySchema.extend({
  status: outboxStatusSchema.optional(),
  topic: z.string().trim().min(1).max(120).optional(),
});

export const outboxListResponseSchema = createPaginatedResponseSchema(outboxEventSchema);

export type OutboxStatus = z.infer<typeof outboxStatusSchema>;
export type OutboxEvent = z.infer<typeof outboxEventSchema>;
export type OutboxQuery = z.output<typeof outboxQuerySchema>;
