import { Injectable, OnModuleInit } from '@nestjs/common';
import { createAnnouncementRequestSchema } from '@ts-business-app-starter/contracts';

import { OutboxHandlerRegistry } from '../../outbox/public';
import { NotificationsRepository } from '../infrastructure/persistence/notifications.repository';

@Injectable()
export class NotificationOutboxHandler implements OnModuleInit {
  constructor(
    private readonly registry: OutboxHandlerRegistry,
    private readonly repository: NotificationsRepository,
  ) {}

  onModuleInit(): void {
    this.registry.register('notifications.create', async (payload) => {
      await this.repository.create(createAnnouncementRequestSchema.parse(payload));
    });
  }
}
