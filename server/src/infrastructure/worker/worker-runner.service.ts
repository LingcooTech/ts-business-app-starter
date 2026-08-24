import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditService } from '../../modules/audit/public';
import {
  JobHandlerRegistry,
  JobsRepository,
  JobsService,
  RecurringJobRegistry,
} from '../../modules/jobs/public';
import { OutboxHandlerRegistry, OutboxRepository } from '../../modules/outbox/public';

@Injectable()
export class WorkerRunner {
  private readonly logger = new Logger(WorkerRunner.name);
  private readonly workerId: string;
  private stopping = false;
  private running: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly jobs: JobsRepository,
    private readonly jobsService: JobsService,
    private readonly jobHandlers: JobHandlerRegistry,
    private readonly recurring: RecurringJobRegistry,
    private readonly outbox: OutboxRepository,
    private readonly outboxHandlers: OutboxHandlerRegistry,
    private readonly audit: AuditService,
  ) {
    this.workerId =
      this.config.get<string>('JOB_WORKER_ID') ??
      `${process.env.HOSTNAME ?? 'local'}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
  }

  start(): void {
    if (this.running) return;
    this.stopping = false;
    this.running = this.loop().finally(() => {
      this.running = null;
    });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    await this.running;
  }

  id(): string {
    return this.workerId;
  }

  private async loop(): Promise<void> {
    const pollMs = this.config.getOrThrow<number>('JOB_POLL_INTERVAL_MS');
    const lockTimeoutMs = this.config.getOrThrow<number>('JOB_LOCK_TIMEOUT_SECONDS') * 1_000;
    const batchSize = this.config.getOrThrow<number>('JOB_BATCH_SIZE');
    let lastRecovery = 0;

    while (!this.stopping) {
      try {
        const now = new Date();
        if (now.getTime() - lastRecovery >= lockTimeoutMs) {
          const cutoff = new Date(now.getTime() - lockTimeoutMs);
          const recoveredJobs = await this.jobs.recoverStale(cutoff);
          const recoveredEvents = await this.outbox.recoverStale(cutoff);
          if (recoveredJobs || recoveredEvents) {
            this.logger.warn(
              `Recovered ${recoveredJobs} jobs and ${recoveredEvents} outbox events`,
            );
          }
          lastRecovery = now.getTime();
        }
        for (const job of this.recurring.due(now)) await this.jobsService.enqueue(job);

        let processed = 0;
        while (!this.stopping && processed < batchSize) {
          const handledJob = await this.processJob();
          const handledEvent = await this.processOutboxEvent();
          if (!handledJob && !handledEvent) break;
          processed += Number(handledJob) + Number(handledEvent);
        }
      } catch (error) {
        this.logger.error(`Worker poll failed: ${this.errorMessage(error)}`);
      }
      if (!this.stopping) await this.delay(pollMs);
    }
  }

  private async processJob(): Promise<boolean> {
    const job = await this.jobs.claim(this.workerId);
    if (!job) return false;
    const heartbeatMs = this.config.getOrThrow<number>('JOB_HEARTBEAT_INTERVAL_MS');
    const heartbeat = setInterval(() => {
      void this.jobs.heartbeat(job.id, this.workerId).catch((error: unknown) => {
        this.logger.error(`Job ${job.id} heartbeat failed: ${this.errorMessage(error)}`);
      });
    }, heartbeatMs);
    try {
      const handler = this.jobHandlers.get(job.type);
      await handler(job.payload, {
        jobId: job.id,
        attempt: job.attempts,
        workerId: this.workerId,
      });
      await this.jobs.succeed(job.id, this.workerId);
    } catch (error) {
      const message = this.errorMessage(error);
      const nextRunAt = new Date(Date.now() + this.backoff(job.attempts));
      const status = await this.jobs.fail(job.id, this.workerId, message, nextRunAt);
      if (status) {
        await this.audit.record({
          actorType: 'job',
          actorId: job.id,
          action: status === 'dead' ? 'job.dead_lettered' : 'job.retry_scheduled',
          resourceType: 'job',
          resourceId: job.id,
          outcome: 'failure',
          metadata: {
            type: job.type,
            attempt: job.attempts,
            maxAttempts: job.maxAttempts,
            error: message,
          },
        });
      }
      this.logger.warn(`Job ${job.id} (${job.type}) ${status ?? 'lost lock'}: ${message}`);
    } finally {
      clearInterval(heartbeat);
    }
    return true;
  }

  private async processOutboxEvent(): Promise<boolean> {
    const event = await this.outbox.claim(this.workerId);
    if (!event) return false;
    try {
      const handler = this.outboxHandlers.get(event.topic);
      await handler(event.payload, {
        eventId: event.id,
        attempt: event.attempts,
        workerId: this.workerId,
      });
      await this.outbox.publish(event.id, this.workerId);
    } catch (error) {
      const message = this.errorMessage(error);
      const nextAvailableAt = new Date(Date.now() + this.backoff(event.attempts));
      const status = await this.outbox.fail(event.id, this.workerId, message, nextAvailableAt);
      if (status) {
        await this.audit.record({
          actorType: 'job',
          actorId: event.id,
          action: status === 'dead' ? 'outbox.dead_lettered' : 'outbox.retry_scheduled',
          resourceType: 'outbox_event',
          resourceId: event.id,
          outcome: 'failure',
          metadata: {
            topic: event.topic,
            attempt: event.attempts,
            maxAttempts: event.maxAttempts,
            error: message,
          },
        });
      }
      this.logger.warn(`Outbox ${event.id} (${event.topic}) ${status ?? 'lost lock'}: ${message}`);
    }
    return true;
  }

  private backoff(attempt: number): number {
    const base = this.config.getOrThrow<number>('JOB_BACKOFF_BASE_MS');
    const maximum = this.config.getOrThrow<number>('JOB_BACKOFF_MAX_MS');
    const exponential = Math.min(maximum, base * 2 ** Math.max(0, attempt - 1));
    return Math.round(exponential * (0.75 + Math.random() * 0.5));
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 10_000);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
