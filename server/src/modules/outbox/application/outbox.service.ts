import { Injectable } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';
import { paginationMeta, type OutboxQuery } from '@ts-business-app-starter/contracts';

import type { DatabaseExecutor } from '../../../common/database/database.port';
import { AuditService, type AuditContext } from '../../audit/public';
import type { AppendOutboxEvent } from '../domain/outbox.types';
import { OutboxRepository } from '../infrastructure/persistence/outbox.repository';

@Injectable()
export class OutboxService {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly audit: AuditService,
  ) {}

  append(input: AppendOutboxEvent, executor: DatabaseExecutor) {
    return this.repository.append(input, executor);
  }

  async list(query: OutboxQuery) {
    const result = await this.repository.search(query);
    return {
      items: result.items,
      meta: paginationMeta({ page: query.page, pageSize: query.pageSize, total: result.total }),
    };
  }

  async get(id: string) {
    const event = await this.repository.findById(id);
    if (!event) throw new ApiError(404, 'OUTBOX_EVENT_NOT_FOUND', 'Outbox event not found');
    return event;
  }

  async retry(id: string, context: AuditContext & { actorId: string }) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new ApiError(404, 'OUTBOX_EVENT_NOT_FOUND', 'Outbox event not found');
    if (existing.status !== 'dead') {
      throw new ApiError(409, 'OUTBOX_EVENT_NOT_DEAD', 'Only dead-letter events can be retried');
    }
    const event = await this.repository.retry(id);
    if (!event) throw new ApiError(404, 'OUTBOX_EVENT_NOT_FOUND', 'Outbox event not found');
    await this.audit.record({
      ...context,
      action: 'outbox.retried',
      resourceType: 'outbox_event',
      resourceId: id,
      metadata: { previousStatus: existing.status, previousAttempts: existing.attempts },
    });
    return { event };
  }
}
