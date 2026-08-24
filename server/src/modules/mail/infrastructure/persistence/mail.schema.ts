import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { jobs } from '../../../jobs/public';

export const mailDeliveries = pgTable(
  'mail_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    idempotencyKey: varchar('idempotency_key', { length: 200 }),
    recipient: varchar('recipient', { length: 320 }).notNull(),
    template: varchar('template', { length: 80 }).notNull(),
    subject: varchar('subject', { length: 300 }).notNull(),
    textBody: text('text_body').notNull(),
    htmlBody: text('html_body'),
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    simulated: varchar('simulated', { length: 5 }).notNull().default('false'),
    lastError: text('last_error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('mail_deliveries_status_check', sql`${table.status} in ('queued', 'sent', 'failed')`),
    check('mail_deliveries_simulated_check', sql`${table.simulated} in ('true', 'false')`),
    index('mail_deliveries_status_idx').on(table.status, table.createdAt),
    index('mail_deliveries_job_idx').on(table.jobId),
    uniqueIndex('mail_deliveries_idempotency_key_unique')
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
);
