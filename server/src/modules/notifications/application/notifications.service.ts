import { Inject, Injectable } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';
import {
  paginationMeta,
  type CreateAnnouncementRequest,
  type NotificationQuery,
} from '@ts-business-app-starter/contracts';

import { DATABASE, type Database } from '../../../common/database/database.port';
import { AuditService, type AuditContext } from '../../audit/public';
import { OutboxService } from '../../outbox/public';
import { NotificationsRepository } from '../infrastructure/persistence/notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly repository: NotificationsRepository,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async list(recipientUserId: string, query: NotificationQuery) {
    const result = await this.repository.search(recipientUserId, query);
    return {
      items: result.items,
      meta: paginationMeta({ page: query.page, pageSize: query.pageSize, total: result.total }),
    };
  }

  async unreadCount(recipientUserId: string) {
    return { count: await this.repository.unreadCount(recipientUserId) };
  }

  async markRead(id: string, recipientUserId: string) {
    const notification = await this.repository.markRead(id, recipientUserId);
    if (!notification) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
    return notification;
  }

  async archive(id: string, recipientUserId: string) {
    const notification = await this.repository.archive(id, recipientUserId);
    if (!notification) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
    return notification;
  }

  async announce(input: CreateAnnouncementRequest, context: AuditContext & { actorId: string }) {
    return this.database.transaction(async (transaction) => {
      const announcementId = crypto.randomUUID();
      const eventId = crypto.randomUUID();
      const event = await this.outbox.append(
        {
          id: eventId,
          topic: 'notifications.create',
          aggregateType: 'notification_announcement',
          aggregateId: announcementId,
          payload: input,
          dedupeKey: input.dedupeKey ? `notification-announcement:${input.dedupeKey}` : undefined,
        },
        transaction,
      );
      const announcement = await this.repository.createAnnouncement(
        announcementId,
        input,
        context.actorId,
        event.id,
        transaction,
      );
      await this.audit.record(
        {
          ...context,
          action: 'notification.announcement_queued',
          resourceType: 'notification_announcement',
          resourceId: announcement.id,
          metadata: { recipientUserId: input.recipientUserId, outboxEventId: event.id },
        },
        transaction,
      );
      return announcement;
    });
  }
}
