import { z } from 'zod';

import { entityIdSchema, isoDateTimeSchema } from './common.js';
import { createPaginatedResponseSchema, paginationQuerySchema } from './pagination.js';

export const jobStatusSchema = z.enum(['pending', 'running', 'succeeded', 'dead']);
export const jobAttemptOutcomeSchema = z.enum(['running', 'succeeded', 'failed']);

export const jobAttemptSchema = z.object({
  id: entityIdSchema,
  attempt: z.number().int().positive(),
  generation: z.number().int().positive(),
  workerId: z.string().min(1).max(200),
  outcome: jobAttemptOutcomeSchema,
  error: z.string().nullable(),
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable(),
});

export const jobSchema = z.object({
  id: entityIdSchema,
  type: z.string().min(1).max(120),
  payload: z.record(z.string(), z.unknown()),
  status: jobStatusSchema,
  priority: z.number().int(),
  runAt: isoDateTimeSchema,
  attempts: z.number().int().nonnegative(),
  generation: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  idempotencyKey: z.string().nullable(),
  lockedBy: z.string().nullable(),
  lockedAt: isoDateTimeSchema.nullable(),
  heartbeatAt: isoDateTimeSchema.nullable(),
  lastError: z.string().nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const jobDetailSchema = jobSchema.extend({ attemptsHistory: z.array(jobAttemptSchema) });

export const jobQuerySchema = paginationQuerySchema.extend({
  status: jobStatusSchema.optional(),
  type: z.string().trim().min(1).max(120).optional(),
});

export const jobListResponseSchema = createPaginatedResponseSchema(jobSchema);
export const retryJobResponseSchema = z.object({ job: jobSchema });

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type JobAttemptOutcome = z.infer<typeof jobAttemptOutcomeSchema>;
export type Job = z.infer<typeof jobSchema>;
export type JobDetail = z.infer<typeof jobDetailSchema>;
export type JobQuery = z.output<typeof jobQuerySchema>;
