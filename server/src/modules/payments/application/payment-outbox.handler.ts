import { Injectable, OnModuleInit } from '@nestjs/common';

import { OutboxHandlerRegistry } from '../../outbox/public';

@Injectable()
export class PaymentOutboxHandler implements OnModuleInit {
  constructor(private readonly registry: OutboxHandlerRegistry) {}

  onModuleInit(): void {
    this.registry.register('payments.succeeded', async () => undefined);
    this.registry.register('payments.refunded', async () => undefined);
  }
}
