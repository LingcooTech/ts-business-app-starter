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

import { identityUsers } from '../../../identity/public';
import { outboxEvents } from '../../../outbox/public';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => identityUsers.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 80 }).notNull(),
    level: varchar('level', { length: 20 }).notNull().default('info'),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    ctaUrl: text('cta_url'),
    dedupeKey: varchar('dedupe_key', { length: 200 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'notifications_level_check',
      sql`${table.level} in ('info', 'success', 'warning', 'error')`,
    ),
    index('notifications_recipient_created_idx').on(table.recipientUserId, table.createdAt),
    index('notifications_recipient_unread_idx').on(table.recipientUserId, table.readAt),
    uniqueIndex('notifications_recipient_dedupe_unique')
      .on(table.recipientUserId, table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
  ],
);

export const notificationAnnouncements = pgTable(
  'notification_announcements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => identityUsers.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 80 }).notNull(),
    level: varchar('level', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    ctaUrl: text('cta_url'),
    dedupeKey: varchar('dedupe_key', { length: 200 }),
    createdBy: uuid('created_by').references(() => identityUsers.id, { onDelete: 'set null' }),
    outboxEventId: uuid('outbox_event_id')
      .notNull()
      .references(() => outboxEvents.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_announcements_outbox_unique').on(table.outboxEventId),
    uniqueIndex('notification_announcements_dedupe_unique')
      .on(table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
  ],
);
