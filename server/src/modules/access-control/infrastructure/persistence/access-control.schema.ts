import { boolean, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { identityUsers } from '../../../identity/public';

export const accessPermissions = pgTable('access_permissions', {
  key: varchar('key', { length: 120 }).primaryKey(),
  description: varchar('description', { length: 300 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accessRoles = pgTable('access_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 120 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  system: boolean('system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accessRolePermissions = pgTable(
  'access_role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => accessRoles.id, { onDelete: 'cascade' }),
    permissionKey: varchar('permission_key', { length: 120 })
      .notNull()
      .references(() => accessPermissions.key, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionKey] })],
);

export const accessUserRoles = pgTable(
  'access_user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => identityUsers.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => accessRoles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);
