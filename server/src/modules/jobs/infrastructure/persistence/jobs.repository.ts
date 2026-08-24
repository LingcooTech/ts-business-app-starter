import { Inject, Injectable } from '@nestjs/common';
import type { JobQuery } from '@ts-business-app-starter/contracts';
import { and, asc, count, desc, eq, ilike, lte, or, sql, type SQL } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DatabaseExecutor,
} from '../../../../common/database/database.port';
import type { EnqueueJob } from '../../domain/jobs.types';
import { jobAttempts, jobs } from './jobs.schema';

@Injectable()
export class JobsRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async enqueue(input: EnqueueJob, executor: DatabaseExecutor = this.database) {
    const [job] = await executor
      .insert(jobs)
      .values({
        type: input.type,
        payload: input.payload,
        runAt: input.runAt,
        priority: input.priority ?? 0,
        maxAttempts: input.maxAttempts ?? 5,
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing()
      .returning();
    if (job) return job;
    if (!input.idempotencyKey) throw new Error('Failed to enqueue job');
    const [existing] = await executor
      .select()
      .from(jobs)
      .where(eq(jobs.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (!existing) throw new Error('Failed to resolve idempotent job');
    return existing;
  }

  async claim(workerId: string) {
    return this.database.transaction(async (transaction) => {
      const [candidate] = await transaction
        .select()
        .from(jobs)
        .where(and(eq(jobs.status, 'pending'), lte(jobs.runAt, new Date())))
        .orderBy(desc(jobs.priority), asc(jobs.runAt), asc(jobs.createdAt))
        .limit(1)
        .for('update', { skipLocked: true });
      if (!candidate) return null;
      const now = new Date();
      const attempt = candidate.attempts + 1;
      const [claimed] = await transaction
        .update(jobs)
        .set({
          status: 'running',
          attempts: attempt,
          lockedBy: workerId,
          lockedAt: now,
          heartbeatAt: now,
          lastError: null,
          updatedAt: now,
        })
        .where(and(eq(jobs.id, candidate.id), eq(jobs.status, 'pending')))
        .returning();
      if (!claimed) return null;
      await transaction.insert(jobAttempts).values({
        jobId: claimed.id,
        generation: claimed.generation,
        attempt,
        workerId,
      });
      return claimed;
    });
  }

  async heartbeat(jobId: string, workerId: string): Promise<boolean> {
    const updated = await this.database
      .update(jobs)
      .set({ heartbeatAt: new Date(), updatedAt: new Date() })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, 'running'), eq(jobs.lockedBy, workerId)))
      .returning({ id: jobs.id });
    return updated.length === 1;
  }

  async succeed(jobId: string, workerId: string): Promise<boolean> {
    return this.finish(jobId, workerId, 'succeeded');
  }

  async fail(
    jobId: string,
    workerId: string,
    error: string,
    nextRunAt: Date,
  ): Promise<'pending' | 'dead' | null> {
    return this.database.transaction(async (transaction) => {
      const [job] = await transaction
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.status, 'running'), eq(jobs.lockedBy, workerId)))
        .limit(1)
        .for('update');
      if (!job) return null;
      const status = job.attempts >= job.maxAttempts ? 'dead' : 'pending';
      const now = new Date();
      await transaction
        .update(jobs)
        .set({
          status,
          runAt: status === 'pending' ? nextRunAt : job.runAt,
          lockedBy: null,
          lockedAt: null,
          heartbeatAt: null,
          lastError: error,
          completedAt: status === 'dead' ? now : null,
          updatedAt: now,
        })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, 'running'), eq(jobs.lockedBy, workerId)));
      await transaction
        .update(jobAttempts)
        .set({ outcome: 'failed', error, finishedAt: now })
        .where(
          and(
            eq(jobAttempts.jobId, jobId),
            eq(jobAttempts.generation, job.generation),
            eq(jobAttempts.attempt, job.attempts),
          ),
        );
      return status;
    });
  }

  async recoverStale(cutoff: Date): Promise<number> {
    const stale = await this.database
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, 'running'), lte(jobs.heartbeatAt, cutoff)));
    let recovered = 0;
    for (const job of stale) {
      const result = await this.fail(
        job.id,
        job.lockedBy ?? '',
        'Worker heartbeat timed out',
        new Date(),
      );
      if (result) recovered += 1;
    }
    return recovered;
  }

  async retry(id: string) {
    const [job] = await this.database
      .update(jobs)
      .set({
        status: 'pending',
        attempts: 0,
        generation: sql`${jobs.generation} + 1`,
        runAt: new Date(),
        lastError: null,
        completedAt: null,
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(jobs.id, id), eq(jobs.status, 'dead')))
      .returning();
    return job ?? null;
  }

  async findById(id: string) {
    const [job] = await this.database.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) return null;
    const attemptsHistory = await this.database
      .select()
      .from(jobAttempts)
      .where(eq(jobAttempts.jobId, id))
      .orderBy(desc(jobAttempts.generation), desc(jobAttempts.attempt));
    return { ...job, attemptsHistory };
  }

  async search(query: JobQuery) {
    const filters: SQL[] = [];
    if (query.status) filters.push(eq(jobs.status, query.status));
    if (query.type) filters.push(eq(jobs.type, query.type));
    if (query.search) {
      const pattern = `%${query.search}%`;
      const search = or(
        ilike(jobs.id, pattern),
        ilike(jobs.type, pattern),
        ilike(jobs.lastError, pattern),
      );
      if (search) filters.push(search);
    }
    const where = filters.length ? and(...filters) : undefined;
    const offset = (query.page - 1) * query.pageSize;
    const [items, totals] = await Promise.all([
      this.database
        .select()
        .from(jobs)
        .where(where)
        .orderBy(desc(jobs.createdAt), desc(jobs.id))
        .limit(query.pageSize)
        .offset(offset),
      this.database.select({ value: count() }).from(jobs).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }

  private async finish(jobId: string, workerId: string, status: 'succeeded'): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [job] = await transaction
        .select({ attempts: jobs.attempts, generation: jobs.generation })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.status, 'running'), eq(jobs.lockedBy, workerId)))
        .limit(1)
        .for('update');
      if (!job) return false;
      const now = new Date();
      await transaction
        .update(jobs)
        .set({
          status,
          lockedBy: null,
          lockedAt: null,
          heartbeatAt: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, 'running'), eq(jobs.lockedBy, workerId)));
      await transaction
        .update(jobAttempts)
        .set({ outcome: 'succeeded', finishedAt: now })
        .where(
          and(
            eq(jobAttempts.jobId, jobId),
            eq(jobAttempts.generation, job.generation),
            eq(jobAttempts.attempt, job.attempts),
          ),
        );
      return true;
    });
  }
}
