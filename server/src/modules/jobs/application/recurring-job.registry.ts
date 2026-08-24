import { Injectable } from '@nestjs/common';

import type { EnqueueJob } from '../domain/jobs.types';

export type RecurringJobDefinition = {
  key: string;
  intervalMs: number;
  job: Omit<EnqueueJob, 'idempotencyKey' | 'runAt'>;
};

@Injectable()
export class RecurringJobRegistry {
  private readonly definitions = new Map<string, RecurringJobDefinition>();

  register(definition: RecurringJobDefinition): void {
    if (definition.intervalMs < 1_000)
      throw new Error('Recurring job interval must be at least 1s');
    if (this.definitions.has(definition.key)) {
      throw new Error(`Recurring job already registered: ${definition.key}`);
    }
    this.definitions.set(definition.key, definition);
  }

  due(now: Date): EnqueueJob[] {
    return [...this.definitions.values()].map((definition) => {
      const bucket = Math.floor(now.getTime() / definition.intervalMs);
      return {
        ...definition.job,
        runAt: now,
        idempotencyKey: `recurring:${definition.key}:${bucket}`,
      };
    });
  }
}
