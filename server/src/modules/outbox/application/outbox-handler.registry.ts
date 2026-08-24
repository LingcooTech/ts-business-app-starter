import { Injectable } from '@nestjs/common';

import type { OutboxHandler } from '../domain/outbox.types';

@Injectable()
export class OutboxHandlerRegistry {
  private readonly handlers = new Map<string, OutboxHandler>();

  register(topic: string, handler: OutboxHandler): void {
    if (this.handlers.has(topic)) throw new Error(`Outbox handler already registered: ${topic}`);
    this.handlers.set(topic, handler);
  }

  get(topic: string): OutboxHandler {
    const handler = this.handlers.get(topic);
    if (!handler) throw new Error(`No outbox handler registered for: ${topic}`);
    return handler;
  }
}
