import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorType: varchar('actor_type', { length: 20 }).notNull(),
    actorId: varchar('actor_id', { length: 200 }),
    action: varchar('action', { length: 120 }).notNull(),
    resourceType: varchar('resource_type', { length: 120 }).notNull(),
    resourceId: varchar('resource_id', { length: 200 }),
    outcome: varchar('outcome', { length: 20 }).notNull(),
    requestId: varchar('request_id', { length: 200 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    check('audit_logs_actor_type_check', sql`${table.actorType} in ('user', 'system', 'job')`),
    check('audit_logs_outcome_check', sql`${table.outcome} in ('success', 'failure')`),
    index('audit_logs_occurred_at_idx').on(table.occurredAt),
    index('audit_logs_actor_idx').on(table.actorType, table.actorId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
    index('audit_logs_request_id_idx').on(table.requestId),
  ],
);
