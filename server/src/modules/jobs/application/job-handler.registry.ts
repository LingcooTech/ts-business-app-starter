import { Injectable } from '@nestjs/common';

import type { JobHandler } from '../domain/jobs.types';

@Injectable()
export class JobHandlerRegistry {
  private readonly handlers = new Map<string, JobHandler>();

  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) throw new Error(`Job handler already registered: ${type}`);
    this.handlers.set(type, handler);
  }

  get(type: string): JobHandler {
    const handler = this.handlers.get(type);
    if (!handler) throw new Error(`No job handler registered for: ${type}`);
    return handler;
  }
}
