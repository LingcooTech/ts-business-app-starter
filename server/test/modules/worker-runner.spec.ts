import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { WorkerRunner } from '../../src/infrastructure/worker/worker-runner.service';
import type { AuditService } from '../../src/modules/audit/public';
import type {
  JobHandlerRegistry,
  JobsRepository,
  JobsService,
  RecurringJobRegistry,
} from '../../src/modules/jobs/public';
import type { OutboxHandlerRegistry, OutboxRepository } from '../../src/modules/outbox/public';

const job = {
  id: 'd61bc281-e32c-4fa6-8126-c4865086423f',
  type: 'test.failure',
  payload: {},
  status: 'running',
  priority: 0,
  runAt: new Date(),
  attempts: 1,
  generation: 1,
  maxAttempts: 3,
  idempotencyKey: null,
  lockedBy: 'worker',
  lockedAt: new Date(),
  heartbeatAt: new Date(),
  lastError: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function harness(handler: () => Promise<void>, failureStatus: 'pending' | 'dead' = 'pending') {
  const config = new ConfigService({
    JOB_WORKER_ID: 'worker-test',
    JOB_HEARTBEAT_INTERVAL_MS: 10_000,
    JOB_BACKOFF_BASE_MS: 100,
    JOB_BACKOFF_MAX_MS: 1_000,
  });
  const jobs = {
    claim: vi.fn().mockResolvedValue(job),
    heartbeat: vi.fn().mockResolvedValue(true),
    succeed: vi.fn().mockResolvedValue(true),
    fail: vi.fn().mockResolvedValue(failureStatus),
  } as unknown as JobsRepository;
  const registry = { get: vi.fn().mockReturnValue(handler) } as unknown as JobHandlerRegistry;
  const outbox = { claim: vi.fn().mockResolvedValue(null) } as unknown as OutboxRepository;
  const audit = { record: vi.fn().mockResolvedValue({}) } as unknown as AuditService;
  const runner = new WorkerRunner(
    config,
    jobs,
    {} as JobsService,
    registry,
    { due: vi.fn().mockReturnValue([]) } as unknown as RecurringJobRegistry,
    outbox,
    {} as OutboxHandlerRegistry,
    audit,
  );
  return {
    runner: runner as unknown as { processJob(): Promise<boolean> },
    jobs,
    audit,
  };
}

describe('WorkerRunner job execution', () => {
  it('marks a successful claimed job complete exactly once', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const { runner, jobs } = harness(handler);

    await expect(runner.processJob()).resolves.toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(jobs.succeed).toHaveBeenCalledWith(job.id, 'worker-test');
    expect(jobs.fail).not.toHaveBeenCalled();
  });

  it('returns a retryable failure to pending with a future run time', async () => {
    const { runner, jobs, audit } = harness(async () => {
      throw new Error('temporary provider failure');
    });
    const before = Date.now();

    await runner.processJob();

    const nextRunAt = vi.mocked(jobs.fail).mock.calls[0]?.[3];
    expect(nextRunAt?.getTime()).toBeGreaterThan(before);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'job.retry_scheduled', outcome: 'failure' }),
    );
  });

  it('audits exhausted jobs as dead letters', async () => {
    const { runner, audit } = harness(async () => {
      throw new Error('permanent failure');
    }, 'dead');

    await runner.processJob();

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'job.dead_lettered', outcome: 'failure' }),
    );
  });
});
