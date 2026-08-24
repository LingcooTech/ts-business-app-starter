import { z } from 'zod';

import { entityIdSchema, isoDateTimeSchema } from './common.js';
import { createPaginatedResponseSchema, paginationQuerySchema } from './pagination.js';

export const notificationLevelSchema = z.enum(['info', 'success', 'warning', 'error']);

export const notificationSchema = z.object({
  id: entityIdSchema,
  recipientUserId: entityIdSchema,
  category: z.string().min(1).max(80),
  level: notificationLevelSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  ctaUrl: z.string().max(2000).nullable(),
  dedupeKey: z.string().nullable(),
  readAt: isoDateTimeSchema.nullable(),
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

const booleanQuerySchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
]);

export const notificationQuerySchema = paginationQuerySchema.extend({
  unreadOnly: booleanQuerySchema.default(false),
  includeArchived: booleanQuerySchema.default(false),
});

export const notificationListResponseSchema = createPaginatedResponseSchema(notificationSchema);
export const unreadNotificationCountSchema = z.object({ count: z.number().int().nonnegative() });

export const createAnnouncementRequestSchema = z.object({
  recipientUserId: entityIdSchema,
  category: z.string().trim().min(1).max(80).default('announcement'),
  level: notificationLevelSchema.default('info'),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  ctaUrl: z.string().trim().max(2000).nullable().optional(),
  dedupeKey: z.string().trim().min(1).max(200).optional(),
});

export const announcementSchema = createAnnouncementRequestSchema.extend({
  id: entityIdSchema,
  createdBy: entityIdSchema.nullable(),
  outboxEventId: entityIdSchema,
  createdAt: isoDateTimeSchema,
});

export type NotificationLevel = z.infer<typeof notificationLevelSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationQuery = z.output<typeof notificationQuerySchema>;
export type CreateAnnouncementRequest = z.output<typeof createAnnouncementRequestSchema>;
