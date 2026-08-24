import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: varchar('topic', { length: 120 }).notNull(),
    aggregateType: varchar('aggregate_type', { length: 120 }),
    aggregateId: varchar('aggregate_id', { length: 200 }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(10),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lockedBy: varchar('locked_by', { length: 200 }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    dedupeKey: varchar('dedupe_key', { length: 200 }),
    lastError: text('last_error'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'outbox_events_status_check',
      sql`${table.status} in ('pending', 'processing', 'published', 'dead')`,
    ),
    check(
      'outbox_events_attempts_check',
      sql`${table.attempts} >= 0 and ${table.attempts} <= ${table.maxAttempts}`,
    ),
    check('outbox_events_max_attempts_check', sql`${table.maxAttempts} > 0`),
    check(
      'outbox_events_lock_state_check',
      sql`(${table.status} = 'processing' and ${table.lockedBy} is not null and ${table.lockedAt} is not null) or (${table.status} <> 'processing' and ${table.lockedBy} is null and ${table.lockedAt} is null)`,
    ),
    index('outbox_events_claim_idx').on(table.status, table.availableAt, table.createdAt),
    index('outbox_events_topic_idx').on(table.topic, table.createdAt),
    uniqueIndex('outbox_events_dedupe_key_unique')
      .on(table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
  ],
);
