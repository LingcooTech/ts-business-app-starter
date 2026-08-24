import { Injectable } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';
import { paginationMeta, type AuditQuery } from '@ts-business-app-starter/contracts';

import type { DatabaseExecutor } from '../../../common/database/database.port';
import type { AuditEvent } from '../domain/audit.types';
import { redactAuditMetadata } from '../domain/redact-metadata';
import { AuditRepository } from '../infrastructure/persistence/audit.repository';

@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  record(event: AuditEvent, executor?: DatabaseExecutor) {
    return this.repository.append(
      { ...event, metadata: redactAuditMetadata(event.metadata) },
      executor,
    );
  }

  async list(query: AuditQuery) {
    const result = await this.repository.search(query);
    return {
      items: result.items,
      meta: paginationMeta({ page: query.page, pageSize: query.pageSize, total: result.total }),
    };
  }

  async get(id: string) {
    const record = await this.repository.findById(id);
    if (!record) throw new ApiError(404, 'AUDIT_LOG_NOT_FOUND', 'Audit log not found');
    return record;
  }
}
