import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/public';
import { OutboxController } from './api/outbox.controller';
import { OutboxHandlerRegistry } from './application/outbox-handler.registry';
import { OutboxService } from './application/outbox.service';
import { OutboxRepository } from './infrastructure/persistence/outbox.repository';

@Module({
  imports: [AuditModule],
  controllers: [OutboxController],
  providers: [OutboxHandlerRegistry, OutboxRepository, OutboxService],
  exports: [OutboxHandlerRegistry, OutboxRepository, OutboxService],
})
export class OutboxModule {}
