import { Inject, Injectable } from '@nestjs/common';
import type {
  PaymentIntentQuery,
  PaymentIntentStatus,
  PaymentProvider,
  PaymentRefundQuery,
  PaymentRefundStatus,
} from '@ts-business-app-starter/contracts';
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DatabaseExecutor,
} from '../../../../common/database/database.port';
import { paymentCallbacks, paymentIntents, paymentRefunds } from './payments.schema';

@Injectable()
export class PaymentsRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  transaction<T>(callback: (transaction: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.database.transaction(callback);
  }

  async createIntent(
    input: {
      provider: PaymentProvider;
      merchantOrderId: string;
      subject: string;
      description: string | null;
      amountMinor: number;
      currency: 'CNY';
      metadata: Record<string, unknown>;
      expiresAt: Date;
      createdBy: string;
    },
    executor: DatabaseExecutor = this.database,
  ) {
    const [intent] = await executor
      .insert(paymentIntents)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (intent) return { intent, created: true };
    const existing = await this.findIntentByMerchantOrderId(input.merchantOrderId, executor);
    if (!existing) throw new Error('Failed to resolve idempotent payment intent');
    return { intent: existing, created: false };
  }

  async findIntentById(id: string, executor: DatabaseExecutor = this.database) {
    const [intent] = await executor
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, id))
      .limit(1);
    return intent ?? null;
  }

  async findIntentByMerchantOrderId(
    merchantOrderId: string,
    executor: DatabaseExecutor = this.database,
  ) {
    const [intent] = await executor
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.merchantOrderId, merchantOrderId))
      .limit(1);
    return intent ?? null;
  }

  async lockIntentById(id: string, executor: DatabaseExecutor) {
    const [intent] = await executor
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, id))
      .limit(1)
      .for('update');
    return intent ?? null;
  }

  async lockIntentByMerchantOrderId(merchantOrderId: string, executor: DatabaseExecutor) {
    const [intent] = await executor
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.merchantOrderId, merchantOrderId))
      .limit(1)
      .for('update');
    return intent ?? null;
  }

  async updateIntent(
    id: string,
    input: {
      status?: PaymentIntentStatus;
      providerTransactionId?: string | null;
      checkoutUrl?: string | null;
      paidAt?: Date | null;
      closedAt?: Date | null;
      refundedAmountMinor?: number;
      lastError?: string | null;
    },
    executor: DatabaseExecutor = this.database,
  ) {
    const [intent] = await executor
      .update(paymentIntents)
      .set({ ...input, version: sql`${paymentIntents.version} + 1`, updatedAt: new Date() })
      .where(eq(paymentIntents.id, id))
      .returning();
    return intent ?? null;
  }

  async searchIntents(query: PaymentIntentQuery) {
    const filters: SQL[] = [];
    if (query.provider) filters.push(eq(paymentIntents.provider, query.provider));
    if (query.status) filters.push(eq(paymentIntents.status, query.status));
    if (query.merchantOrderId) {
      filters.push(eq(paymentIntents.merchantOrderId, query.merchantOrderId));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      const search = or(
        ilike(paymentIntents.id, pattern),
        ilike(paymentIntents.merchantOrderId, pattern),
        ilike(paymentIntents.providerTransactionId, pattern),
        ilike(paymentIntents.subject, pattern),
      );
      if (search) filters.push(search);
    }
    const where = filters.length ? and(...filters) : undefined;
    const offset = (query.page - 1) * query.pageSize;
    const [items, totals] = await Promise.all([
      this.database
        .select()
        .from(paymentIntents)
        .where(where)
        .orderBy(desc(paymentIntents.createdAt), desc(paymentIntents.id))
        .limit(query.pageSize)
        .offset(offset),
      this.database.select({ value: count() }).from(paymentIntents).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }

  async createRefund(
    input: {
      paymentIntentId: string;
      merchantRefundId: string;
      amountMinor: number;
      reason: string | null;
      createdBy: string;
    },
    executor: DatabaseExecutor = this.database,
  ) {
    const [refund] = await executor
      .insert(paymentRefunds)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (refund) return { refund, created: true };
    const existing = await this.findRefundByMerchantRefundId(input.merchantRefundId, executor);
    if (!existing) throw new Error('Failed to resolve idempotent payment refund');
    return { refund: existing, created: false };
  }

  async findRefundById(id: string, executor: DatabaseExecutor = this.database) {
    const [refund] = await executor
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.id, id))
      .limit(1);
    return refund ?? null;
  }

  async findRefundByMerchantRefundId(
    merchantRefundId: string,
    executor: DatabaseExecutor = this.database,
  ) {
    const [refund] = await executor
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.merchantRefundId, merchantRefundId))
      .limit(1);
    return refund ?? null;
  }

  async lockRefundById(id: string, executor: DatabaseExecutor) {
    const [refund] = await executor
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.id, id))
      .limit(1)
      .for('update');
    return refund ?? null;
  }

  async lockRefundByMerchantRefundId(merchantRefundId: string, executor: DatabaseExecutor) {
    const [refund] = await executor
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.merchantRefundId, merchantRefundId))
      .limit(1)
      .for('update');
    return refund ?? null;
  }

  async updateRefund(
    id: string,
    input: {
      status?: PaymentRefundStatus;
      providerRefundId?: string | null;
      refundedAt?: Date | null;
      lastError?: string | null;
    },
    executor: DatabaseExecutor = this.database,
  ) {
    const [refund] = await executor
      .update(paymentRefunds)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(paymentRefunds.id, id))
      .returning();
    return refund ?? null;
  }

  async searchRefunds(query: PaymentRefundQuery) {
    const filters: SQL[] = [];
    if (query.status) filters.push(eq(paymentRefunds.status, query.status));
    if (query.paymentIntentId) {
      filters.push(eq(paymentRefunds.paymentIntentId, query.paymentIntentId));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      const search = or(
        ilike(paymentRefunds.id, pattern),
        ilike(paymentRefunds.merchantRefundId, pattern),
        ilike(paymentRefunds.providerRefundId, pattern),
      );
      if (search) filters.push(search);
    }
    const where = filters.length ? and(...filters) : undefined;
    const offset = (query.page - 1) * query.pageSize;
    const [items, totals] = await Promise.all([
      this.database
        .select()
        .from(paymentRefunds)
        .where(where)
        .orderBy(desc(paymentRefunds.createdAt), desc(paymentRefunds.id))
        .limit(query.pageSize)
        .offset(offset),
      this.database.select({ value: count() }).from(paymentRefunds).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }

  async reservedRefundAmount(paymentIntentId: string, executor: DatabaseExecutor = this.database) {
    const [result] = await executor
      .select({
        value: sql<number>`coalesce(sum(${paymentRefunds.amountMinor}), 0)`,
      })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.paymentIntentId, paymentIntentId),
          inArray(paymentRefunds.status, ['pending', 'succeeded']),
        ),
      );
    return Number(result?.value ?? 0);
  }

  async createCallback(
    input: {
      provider: Extract<PaymentProvider, 'alipay' | 'wechat'>;
      eventId: string;
      eventType: string;
      bodySha256: string;
    },
    executor: DatabaseExecutor = this.database,
  ) {
    const [callback] = await executor
      .insert(paymentCallbacks)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (callback) return { callback, created: true };
    const [existing] = await executor
      .select()
      .from(paymentCallbacks)
      .where(
        and(
          eq(paymentCallbacks.provider, input.provider),
          eq(paymentCallbacks.eventId, input.eventId),
        ),
      )
      .limit(1);
    if (!existing) throw new Error('Failed to resolve idempotent payment callback');
    if (existing.status === 'rejected' && existing.bodySha256 === input.bodySha256) {
      const [retried] = await executor
        .update(paymentCallbacks)
        .set({
          status: 'received',
          lastError: null,
          processedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(paymentCallbacks.id, existing.id),
            eq(paymentCallbacks.status, 'rejected'),
            eq(paymentCallbacks.bodySha256, input.bodySha256),
          ),
        )
        .returning();
      if (retried) return { callback: retried, created: true };
    }
    return { callback: existing, created: false };
  }

  async completeCallback(
    id: string,
    input: { paymentIntentId: string; paymentRefundId?: string | null },
    executor: DatabaseExecutor = this.database,
  ) {
    const [callback] = await executor
      .update(paymentCallbacks)
      .set({
        status: 'processed',
        paymentIntentId: input.paymentIntentId,
        paymentRefundId: input.paymentRefundId,
        lastError: null,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentCallbacks.id, id))
      .returning();
    return callback ?? null;
  }

  async rejectCallback(id: string, error: string) {
    await this.database
      .update(paymentCallbacks)
      .set({ status: 'rejected', lastError: error.slice(0, 10_000), updatedAt: new Date() })
      .where(eq(paymentCallbacks.id, id));
  }
}
