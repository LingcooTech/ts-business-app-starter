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

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 120 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    priority: integer('priority').notNull().default(0),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    generation: integer('generation').notNull().default(1),
    maxAttempts: integer('max_attempts').notNull().default(5),
    idempotencyKey: varchar('idempotency_key', { length: 200 }),
    lockedBy: varchar('locked_by', { length: 200 }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
    lastError: text('last_error'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('jobs_status_check', sql`${table.status} in ('pending', 'running', 'succeeded', 'dead')`),
    check(
      'jobs_attempts_check',
      sql`${table.attempts} >= 0 and ${table.attempts} <= ${table.maxAttempts}`,
    ),
    check('jobs_max_attempts_check', sql`${table.maxAttempts} > 0`),
    check('jobs_generation_check', sql`${table.generation} > 0`),
    check(
      'jobs_lock_state_check',
      sql`(${table.status} = 'running' and ${table.lockedBy} is not null and ${table.lockedAt} is not null and ${table.heartbeatAt} is not null) or (${table.status} <> 'running' and ${table.lockedBy} is null and ${table.lockedAt} is null and ${table.heartbeatAt} is null)`,
    ),
    index('jobs_claim_idx').on(table.status, table.runAt, table.priority),
    index('jobs_type_idx').on(table.type, table.createdAt),
    uniqueIndex('jobs_idempotency_key_unique')
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
);

export const jobAttempts = pgTable(
  'job_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    generation: integer('generation').notNull().default(1),
    workerId: varchar('worker_id', { length: 200 }).notNull(),
    outcome: varchar('outcome', { length: 20 }).notNull().default('running'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    check('job_attempts_attempt_check', sql`${table.attempt} > 0`),
    check('job_attempts_generation_check', sql`${table.generation} > 0`),
    check(
      'job_attempts_outcome_check',
      sql`${table.outcome} in ('running', 'succeeded', 'failed')`,
    ),
    uniqueIndex('job_attempts_job_generation_attempt_unique').on(
      table.jobId,
      table.generation,
      table.attempt,
    ),
    index('job_attempts_job_idx').on(table.jobId, table.startedAt),
  ],
);
