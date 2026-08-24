import { describe, expect, it, vi } from 'vitest';

import type { Database, DatabaseTransaction } from '../../src/common/database/database.port';
import type { AuditService } from '../../src/modules/audit/public';
import type { JobsService } from '../../src/modules/jobs/public';
import { MailService } from '../../src/modules/mail/application/mail.service';
import type { MailRepository } from '../../src/modules/mail/infrastructure/persistence/mail.repository';

describe('MailService', () => {
  it('creates the delivery, job, and audit event in one transaction', async () => {
    const transaction = {} as DatabaseTransaction;
    const database = {
      transaction: vi.fn(async (operation: (executor: DatabaseTransaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    } as unknown as Database;
    const now = new Date('2026-08-24T10:00:00Z');
    const delivery = {
      id: 'eb29a4df-95c9-4b94-85a9-9a44d2d46562',
      jobId: null,
      idempotencyKey: null,
      recipient: 'owner@example.com',
      template: 'test',
      subject: 'Test',
      textBody: 'Body',
      htmlBody: null,
      status: 'queued',
      simulated: 'false',
      lastError: null,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const repository = {
      create: vi.fn().mockResolvedValue(delivery),
      attachJob: vi
        .fn()
        .mockResolvedValue({ ...delivery, jobId: '60a4b249-533f-45c3-a05c-dad7e44c22af' }),
    } as unknown as MailRepository;
    const jobs = {
      enqueue: vi.fn().mockResolvedValue({ id: '60a4b249-533f-45c3-a05c-dad7e44c22af' }),
    } as unknown as JobsService;
    const audit = { record: vi.fn().mockResolvedValue({}) } as unknown as AuditService;
    const service = new MailService(database, repository, jobs, audit);

    const result = await service.queue({
      to: delivery.recipient,
      subject: delivery.subject,
      text: delivery.textBody,
      template: 'test',
    });

    expect(result).toMatchObject({ status: 'queued', simulated: false });
    expect(vi.mocked(repository.create).mock.calls[0]?.[3]).toBe(transaction);
    expect(vi.mocked(jobs.enqueue).mock.calls[0]?.[1]).toBe(transaction);
    expect(vi.mocked(repository.attachJob).mock.calls[0]?.[2]).toBe(transaction);
    expect(vi.mocked(audit.record).mock.calls[0]?.[1]).toBe(transaction);
  });
});
