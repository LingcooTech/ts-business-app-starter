import { z } from 'zod';

import { entityIdSchema, isoDateTimeSchema, requestIdSchema } from './common.js';
import { createPaginatedResponseSchema, paginationQuerySchema } from './pagination.js';

export const auditActorTypeSchema = z.enum(['user', 'system', 'job', 'provider']);
export const auditOutcomeSchema = z.enum(['success', 'failure']);

export const auditLogSchema = z.object({
  id: entityIdSchema,
  occurredAt: isoDateTimeSchema,
  actorType: auditActorTypeSchema,
  actorId: z.string().trim().min(1).max(200).nullable(),
  action: z.string().trim().min(1).max(120),
  resourceType: z.string().trim().min(1).max(120),
  resourceId: z.string().trim().min(1).max(200).nullable(),
  outcome: auditOutcomeSchema,
  requestId: requestIdSchema.nullable(),
  ipAddress: z.string().trim().min(1).max(64).nullable(),
  userAgent: z.string().trim().min(1).max(512).nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const auditQuerySchema = paginationQuerySchema.extend({
  actorType: auditActorTypeSchema.optional(),
  action: z.string().trim().min(1).max(120).optional(),
  resourceType: z.string().trim().min(1).max(120).optional(),
  outcome: auditOutcomeSchema.optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});

export const auditListResponseSchema = createPaginatedResponseSchema(auditLogSchema);

export type AuditActorType = z.infer<typeof auditActorTypeSchema>;
export type AuditOutcome = z.infer<typeof auditOutcomeSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type AuditQuery = z.output<typeof auditQuerySchema>;
