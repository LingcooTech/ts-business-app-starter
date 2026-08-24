import { Inject, Injectable } from '@nestjs/common';
import type { OutboxQuery } from '@ts-business-app-starter/contracts';
import { and, asc, count, desc, eq, ilike, lte, or, type SQL } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DatabaseExecutor,
} from '../../../../common/database/database.port';
import type { AppendOutboxEvent } from '../../domain/outbox.types';
import { outboxEvents } from './outbox.schema';

@Injectable()
export class OutboxRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async append(input: AppendOutboxEvent, executor: DatabaseExecutor = this.database) {
    const [event] = await executor
      .insert(outboxEvents)
      .values({
        id: input.id,
        topic: input.topic,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: input.payload,
        availableAt: input.availableAt,
        maxAttempts: input.maxAttempts ?? 10,
        dedupeKey: input.dedupeKey,
      })
      .onConflictDoNothing()
      .returning();
    if (event) return event;
    if (!input.dedupeKey) throw new Error('Failed to append outbox event');
    const [existing] = await executor
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.dedupeKey, input.dedupeKey))
      .limit(1);
    if (!existing) throw new Error('Failed to resolve idempotent outbox event');
    return existing;
  }

  async claim(workerId: string) {
    return this.database.transaction(async (transaction) => {
      const [candidate] = await transaction
        .select()
        .from(outboxEvents)
        .where(and(eq(outboxEvents.status, 'pending'), lte(outboxEvents.availableAt, new Date())))
        .orderBy(asc(outboxEvents.availableAt), asc(outboxEvents.createdAt))
        .limit(1)
        .for('update', { skipLocked: true });
      if (!candidate) return null;
      const now = new Date();
      const [claimed] = await transaction
        .update(outboxEvents)
        .set({
          status: 'processing',
          attempts: candidate.attempts + 1,
          lockedBy: workerId,
          lockedAt: now,
          lastError: null,
          updatedAt: now,
        })
        .where(and(eq(outboxEvents.id, candidate.id), eq(outboxEvents.status, 'pending')))
        .returning();
      return claimed ?? null;
    });
  }

  async publish(id: string, workerId: string): Promise<boolean> {
    const now = new Date();
    const updated = await this.database
      .update(outboxEvents)
      .set({
        status: 'published',
        lockedBy: null,
        lockedAt: null,
        publishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(outboxEvents.id, id),
          eq(outboxEvents.status, 'processing'),
          eq(outboxEvents.lockedBy, workerId),
        ),
      )
      .returning({ id: outboxEvents.id });
    return updated.length === 1;
  }

  async fail(
    id: string,
    workerId: string,
    error: string,
    nextAvailableAt: Date,
  ): Promise<'pending' | 'dead' | null> {
    return this.database.transaction(async (transaction) => {
      const [event] = await transaction
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.id, id),
            eq(outboxEvents.status, 'processing'),
            eq(outboxEvents.lockedBy, workerId),
          ),
        )
        .limit(1)
        .for('update');
      if (!event) return null;
      const status = event.attempts >= event.maxAttempts ? 'dead' : 'pending';
      const [updated] = await transaction
        .update(outboxEvents)
        .set({
          status,
          availableAt: status === 'pending' ? nextAvailableAt : event.availableAt,
          lockedBy: null,
          lockedAt: null,
          lastError: error,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(outboxEvents.id, id),
            eq(outboxEvents.status, 'processing'),
            eq(outboxEvents.lockedBy, workerId),
          ),
        )
        .returning({ status: outboxEvents.status });
      return updated ? status : null;
    });
  }

  async recoverStale(cutoff: Date): Promise<number> {
    const stale = await this.database
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.status, 'processing'), lte(outboxEvents.lockedAt, cutoff)));
    let recovered = 0;
    for (const event of stale) {
      const result = await this.fail(
        event.id,
        event.lockedBy ?? '',
        'Outbox lock timed out',
        new Date(),
      );
      if (result) recovered += 1;
    }
    return recovered;
  }

  async retry(id: string) {
    const [event] = await this.database
      .update(outboxEvents)
      .set({
        status: 'pending',
        attempts: 0,
        availableAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        lastError: null,
        publishedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(outboxEvents.id, id), eq(outboxEvents.status, 'dead')))
      .returning();
    return event ?? null;
  }

  async findById(id: string) {
    const [event] = await this.database
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, id))
      .limit(1);
    return event ?? null;
  }

  async search(query: OutboxQuery) {
    const filters: SQL[] = [];
    if (query.status) filters.push(eq(outboxEvents.status, query.status));
    if (query.topic) filters.push(eq(outboxEvents.topic, query.topic));
    if (query.search) {
      const pattern = `%${query.search}%`;
      const search = or(
        ilike(outboxEvents.id, pattern),
        ilike(outboxEvents.topic, pattern),
        ilike(outboxEvents.aggregateId, pattern),
        ilike(outboxEvents.lastError, pattern),
      );
      if (search) filters.push(search);
    }
    const where = filters.length ? and(...filters) : undefined;
    const offset = (query.page - 1) * query.pageSize;
    const [items, totals] = await Promise.all([
      this.database
        .select()
        .from(outboxEvents)
        .where(where)
        .orderBy(desc(outboxEvents.createdAt), desc(outboxEvents.id))
        .limit(query.pageSize)
        .offset(offset),
      this.database.select({ value: count() }).from(outboxEvents).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }
}
