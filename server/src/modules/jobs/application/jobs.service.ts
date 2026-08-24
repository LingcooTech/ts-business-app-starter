import { Injectable } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';
import { paginationMeta, type JobQuery } from '@ts-business-app-starter/contracts';

import type { DatabaseExecutor } from '../../../common/database/database.port';
import { AuditService, type AuditContext } from '../../audit/public';
import type { EnqueueJob } from '../domain/jobs.types';
import { JobsRepository } from '../infrastructure/persistence/jobs.repository';

@Injectable()
export class JobsService {
  constructor(
    private readonly repository: JobsRepository,
    private readonly audit: AuditService,
  ) {}

  enqueue(input: EnqueueJob, executor?: DatabaseExecutor) {
    return this.repository.enqueue(input, executor);
  }

  async list(query: JobQuery) {
    const result = await this.repository.search(query);
    return {
      items: result.items,
      meta: paginationMeta({ page: query.page, pageSize: query.pageSize, total: result.total }),
    };
  }

  async get(id: string) {
    const job = await this.repository.findById(id);
    if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found');
    return job;
  }

  async retry(id: string, context: AuditContext & { actorId: string }) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found');
    if (existing.status !== 'dead') {
      throw new ApiError(409, 'JOB_NOT_DEAD', 'Only dead-letter jobs can be retried');
    }
    const job = await this.repository.retry(id);
    if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found');
    await this.audit.record({
      ...context,
      action: 'job.retried',
      resourceType: 'job',
      resourceId: id,
      metadata: { previousStatus: existing.status, previousAttempts: existing.attempts },
    });
    return { job };
  }
}
