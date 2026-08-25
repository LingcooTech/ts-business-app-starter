import { sql } from 'drizzle-orm';
import {
  bigint,
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

import { identityUsers } from '../../../identity/public';

export const paymentIntents = pgTable(
  'payment_intents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 20 }).notNull(),
    merchantOrderId: varchar('merchant_order_id', { length: 64 }).notNull(),
    providerTransactionId: varchar('provider_transaction_id', { length: 128 }),
    subject: varchar('subject', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    refundedAmountMinor: bigint('refunded_amount_minor', { mode: 'number' }).notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('CNY'),
    status: varchar('status', { length: 30 }).notNull().default('created'),
    checkoutUrl: text('checkout_url'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => identityUsers.id, { onDelete: 'set null' }),
    lastError: text('last_error'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('payment_intents_provider_check', sql`${table.provider} in ('mock', 'alipay', 'wechat')`),
    check(
      'payment_intents_status_check',
      sql`${table.status} in ('created', 'pending', 'succeeded', 'closed', 'failed', 'partially_refunded', 'refunded')`,
    ),
    check('payment_intents_currency_check', sql`${table.currency} = 'CNY'`),
    check('payment_intents_amount_check', sql`${table.amountMinor} > 0`),
    check(
      'payment_intents_refunded_amount_check',
      sql`${table.refundedAmountMinor} >= 0 and ${table.refundedAmountMinor} <= ${table.amountMinor}`,
    ),
    uniqueIndex('payment_intents_merchant_order_unique').on(table.merchantOrderId),
    uniqueIndex('payment_intents_provider_transaction_unique')
      .on(table.provider, table.providerTransactionId)
      .where(sql`${table.providerTransactionId} is not null`),
    index('payment_intents_status_created_idx').on(table.status, table.createdAt),
  ],
);

export const paymentRefunds = pgTable(
  'payment_refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentIntentId: uuid('payment_intent_id')
      .notNull()
      .references(() => paymentIntents.id, { onDelete: 'restrict' }),
    merchantRefundId: varchar('merchant_refund_id', { length: 64 }).notNull(),
    providerRefundId: varchar('provider_refund_id', { length: 128 }),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    reason: varchar('reason', { length: 300 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    lastError: text('last_error'),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => identityUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'payment_refunds_status_check',
      sql`${table.status} in ('pending', 'succeeded', 'failed')`,
    ),
    check('payment_refunds_amount_check', sql`${table.amountMinor} > 0`),
    uniqueIndex('payment_refunds_merchant_refund_unique').on(table.merchantRefundId),
    uniqueIndex('payment_refunds_provider_refund_unique')
      .on(table.providerRefundId)
      .where(sql`${table.providerRefundId} is not null`),
    index('payment_refunds_intent_created_idx').on(table.paymentIntentId, table.createdAt),
  ],
);

export const paymentCallbacks = pgTable(
  'payment_callbacks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 20 }).notNull(),
    eventId: varchar('event_id', { length: 160 }).notNull(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    bodySha256: varchar('body_sha256', { length: 64 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('received'),
    paymentIntentId: uuid('payment_intent_id').references(() => paymentIntents.id, {
      onDelete: 'restrict',
    }),
    paymentRefundId: uuid('payment_refund_id').references(() => paymentRefunds.id, {
      onDelete: 'restrict',
    }),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('payment_callbacks_provider_check', sql`${table.provider} in ('alipay', 'wechat')`),
    check(
      'payment_callbacks_status_check',
      sql`${table.status} in ('received', 'processed', 'rejected')`,
    ),
    uniqueIndex('payment_callbacks_provider_event_unique').on(table.provider, table.eventId),
    index('payment_callbacks_status_created_idx').on(table.status, table.createdAt),
  ],
);
