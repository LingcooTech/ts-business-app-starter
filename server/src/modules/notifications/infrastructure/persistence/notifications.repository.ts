import { Inject, Injectable } from '@nestjs/common';
import type { CreateAnnouncementRequest } from '@ts-business-app-starter/contracts';
import type { NotificationQuery } from '@ts-business-app-starter/contracts';
import { and, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DatabaseExecutor,
} from '../../../../common/database/database.port';
import { notificationAnnouncements, notifications } from './notifications.schema';

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(input: CreateAnnouncementRequest, executor: DatabaseExecutor = this.database) {
    const [notification] = await executor
      .insert(notifications)
      .values({
        recipientUserId: input.recipientUserId,
        category: input.category,
        level: input.level,
        title: input.title,
        body: input.body,
        ctaUrl: input.ctaUrl ?? null,
        dedupeKey: input.dedupeKey,
      })
      .onConflictDoNothing()
      .returning();
    if (notification) return notification;
    if (!input.dedupeKey) throw new Error('Failed to create notification');
    const [existing] = await executor
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, input.recipientUserId),
          eq(notifications.dedupeKey, input.dedupeKey),
        ),
      )
      .limit(1);
    if (!existing) throw new Error('Failed to resolve deduplicated notification');
    return existing;
  }

  async createAnnouncement(
    id: string,
    input: CreateAnnouncementRequest,
    createdBy: string,
    outboxEventId: string,
    executor: DatabaseExecutor,
  ) {
    const [announcement] = await executor
      .insert(notificationAnnouncements)
      .values({
        id,
        recipientUserId: input.recipientUserId,
        category: input.category,
        level: input.level,
        title: input.title,
        body: input.body,
        ctaUrl: input.ctaUrl ?? null,
        dedupeKey: input.dedupeKey,
        createdBy,
        outboxEventId,
      })
      .onConflictDoNothing()
      .returning();
    if (announcement) return announcement;
    if (!input.dedupeKey) throw new Error('Failed to create announcement');
    const [existing] = await executor
      .select()
      .from(notificationAnnouncements)
      .where(eq(notificationAnnouncements.dedupeKey, input.dedupeKey))
      .limit(1);
    if (!existing) throw new Error('Failed to resolve idempotent announcement');
    return existing;
  }

  async search(recipientUserId: string, query: NotificationQuery) {
    const filters: SQL[] = [eq(notifications.recipientUserId, recipientUserId)];
    if (query.unreadOnly) filters.push(isNull(notifications.readAt));
    if (!query.includeArchived) filters.push(isNull(notifications.archivedAt));
    if (query.search) {
      const pattern = `%${query.search}%`;
      const search = or(ilike(notifications.title, pattern), ilike(notifications.body, pattern));
      if (search) filters.push(search);
    }
    const where = and(...filters);
    const offset = (query.page - 1) * query.pageSize;
    const [items, totals] = await Promise.all([
      this.database
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(query.pageSize)
        .offset(offset),
      this.database.select({ value: count() }).from(notifications).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }

  async unreadCount(recipientUserId: string) {
    const [result] = await this.database
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, recipientUserId),
          isNull(notifications.readAt),
          isNull(notifications.archivedAt),
        ),
      );
    return result?.value ?? 0;
  }

  async markRead(id: string, recipientUserId: string) {
    const [notification] = await this.database
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.recipientUserId, recipientUserId)))
      .returning();
    return notification ?? null;
  }

  async archive(id: string, recipientUserId: string) {
    const [notification] = await this.database
      .update(notifications)
      .set({ archivedAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.recipientUserId, recipientUserId)))
      .returning();
    return notification ?? null;
  }
}
