import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/public';
import { OutboxModule } from '../outbox/public';
import { NotificationsController } from './api/notifications.controller';
import { NotificationOutboxHandler } from './application/notification-outbox.handler';
import { NotificationsService } from './application/notifications.service';
import { NotificationsRepository } from './infrastructure/persistence/notifications.repository';

@Module({
  imports: [AuditModule, OutboxModule],
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService, NotificationOutboxHandler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
