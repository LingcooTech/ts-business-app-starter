import { Inject, Injectable } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';
import {
  paginationMeta,
  type MailDeliveryQuery,
  type SendTestMailRequest,
} from '@ts-business-app-starter/contracts';

import { DATABASE, type Database } from '../../../common/database/database.port';
import { AuditService, type AuditContext } from '../../audit/public';
import { JobsService } from '../../jobs/public';
import type { QueueMail } from '../domain/mail.types';
import { testMail } from '../domain/mail-templates';
import { MailRepository } from '../infrastructure/persistence/mail.repository';

@Injectable()
export class MailService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly repository: MailRepository,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  async queue(input: QueueMail, context: AuditContext = { actorType: 'system' }) {
    const delivery = await this.database.transaction(async (transaction) => {
      const record = await this.repository.create(
        input,
        input.template,
        input.idempotencyKey,
        transaction,
      );
      if (record.jobId) return record;
      const job = await this.jobs.enqueue(
        {
          type: 'mail.send',
          payload: { deliveryId: record.id },
          maxAttempts: 5,
          idempotencyKey: input.idempotencyKey
            ? `mail:${input.idempotencyKey}`
            : `mail-delivery:${record.id}`,
        },
        transaction,
      );
      const queued = await this.repository.attachJob(record.id, job.id, transaction);
      await this.audit.record(
        {
          ...context,
          action: 'mail.queued',
          resourceType: 'mail_delivery',
          resourceId: queued.id,
          metadata: { template: queued.template, recipient: queued.recipient, jobId: job.id },
        },
        transaction,
      );
      return queued;
    });
    return this.toView(delivery);
  }

  async queueTest(input: SendTestMailRequest, applicationName: string, context: AuditContext) {
    return {
      delivery: await this.queue(
        { ...testMail(input.to, applicationName), template: 'test' },
        context,
      ),
    };
  }

  async list(query: MailDeliveryQuery) {
    const result = await this.repository.search(query);
    return {
      items: result.items.map((record) => this.toView(record)),
      meta: paginationMeta({ page: query.page, pageSize: query.pageSize, total: result.total }),
    };
  }

  async get(id: string) {
    const delivery = await this.repository.findById(id);
    if (!delivery) throw new ApiError(404, 'MAIL_DELIVERY_NOT_FOUND', 'Mail delivery not found');
    return this.toView(delivery);
  }

  private toView(record: NonNullable<Awaited<ReturnType<MailRepository['findById']>>>) {
    return {
      id: record.id,
      jobId: record.jobId,
      recipient: record.recipient,
      template: record.template,
      subject: record.subject,
      status: record.status,
      simulated: record.simulated === 'true',
      lastError: record.lastError,
      sentAt: record.sentAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
