import { sql } from 'drizzle-orm';
import {
  bigint,
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

export const storageObjects = pgTable(
  'storage_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 20 }).notNull(),
    bucket: varchar('bucket', { length: 255 }).notNull(),
    key: text('object_key').notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 255 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    visibility: varchar('visibility', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    etag: varchar('etag', { length: 255 }),
    createdBy: uuid('created_by').references(() => identityUsers.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('storage_objects_provider_check', sql`${table.provider} in ('local', 's3')`),
    check('storage_objects_visibility_check', sql`${table.visibility} in ('public', 'private')`),
    check('storage_objects_status_check', sql`${table.status} in ('pending', 'ready', 'deleted')`),
    check('storage_objects_size_check', sql`${table.sizeBytes} >= 0`),
    uniqueIndex('storage_objects_provider_key_unique').on(table.provider, table.bucket, table.key),
    index('storage_objects_status_created_idx').on(table.status, table.createdAt),
    index('storage_objects_created_by_idx').on(table.createdBy, table.createdAt),
  ],
);
