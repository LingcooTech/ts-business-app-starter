export { OutboxModule } from './outbox.module';
export { OutboxHandlerRegistry } from './application/outbox-handler.registry';
export { OutboxService } from './application/outbox.service';
export { OutboxRepository } from './infrastructure/persistence/outbox.repository';
export { outboxEvents } from './infrastructure/persistence/outbox.schema';
export type { AppendOutboxEvent, OutboxHandler, OutboxHandlerContext } from './domain/outbox.types';
