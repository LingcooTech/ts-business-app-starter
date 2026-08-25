import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';
import {
  paginationMeta,
  type CreatePaymentIntentRequest,
  type CreatePaymentRefundRequest,
  type PaymentIntentQuery,
  type PaymentIntentStatus,
  type PaymentProvider,
  type PaymentRefundQuery,
} from '@ts-business-app-starter/contracts';

import type { DatabaseExecutor } from '../../../common/database/database.port';
import { AuditService, type AuditContext } from '../../audit/public';
import { JobsService } from '../../jobs/public';
import { OutboxService } from '../../outbox/public';
import { canTransitionPayment, refundedPaymentStatus } from '../domain/payment-state';
import type {
  ProviderPaymentResult,
  ProviderRefundResult,
  VerifiedProviderCallback,
} from '../domain/payment.types';
import { PaymentAdapterFactory } from '../infrastructure/adapters/payment-adapter.factory';
import { PaymentsRepository } from '../infrastructure/persistence/payments.repository';
import { PaymentSettingsService } from './payment-settings.service';

type PaymentIntentRecord = NonNullable<Awaited<ReturnType<PaymentsRepository['findIntentById']>>>;
type PaymentRefundRecord = NonNullable<Awaited<ReturnType<PaymentsRepository['findRefundById']>>>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly adapters: PaymentAdapterFactory,
    private readonly settings: PaymentSettingsService,
    private readonly jobs: JobsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreatePaymentIntentRequest, context: AuditContext & { actorId: string }) {
    const provider = input.provider ?? (await this.settings.provider());
    this.settings.ensureProviderAllowed(provider);
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1_000);
    const created = await this.repository.transaction(async (transaction) => {
      const result = await this.repository.createIntent(
        {
          provider,
          merchantOrderId: input.merchantOrderId,
          subject: input.subject,
          description: input.description ?? null,
          amountMinor: input.amountMinor,
          currency: input.currency,
          metadata: input.metadata,
          expiresAt,
          createdBy: context.actorId,
        },
        transaction,
      );
      if (result.created) {
        await this.jobs.enqueue(
          {
            type: 'payment.reconcile',
            payload: { paymentIntentId: result.intent.id },
            runAt: new Date(Date.now() + 30_000),
            maxAttempts: 10,
            idempotencyKey: `payment-reconcile:${result.intent.id}`,
          },
          transaction,
        );
        await this.jobs.enqueue(
          {
            type: 'payment.close-expired',
            payload: { paymentIntentId: result.intent.id },
            runAt: result.intent.expiresAt,
            maxAttempts: 10,
            idempotencyKey: `payment-close:${result.intent.id}`,
          },
          transaction,
        );
      }
      return result;
    });
    if (!created.created) {
      this.assertSameIntent(created.intent, input, provider);
      return { intent: created.intent };
    }

    try {
      const result = await this.adapters.forProvider(provider).create({
        paymentIntentId: created.intent.id,
        merchantOrderId: created.intent.merchantOrderId,
        subject: created.intent.subject,
        description: created.intent.description,
        amountMinor: created.intent.amountMinor,
        currency: 'CNY',
        expiresAt: created.intent.expiresAt,
      });
      const intent = await this.repository.transaction(async (transaction) => {
        const updated = await this.applyPaymentResult(created.intent.id, result, transaction);
        await this.audit.record(
          {
            ...context,
            action: 'payment.intent_created',
            resourceType: 'payment_intent',
            resourceId: created.intent.id,
            metadata: {
              provider,
              merchantOrderId: input.merchantOrderId,
              amountMinor: input.amountMinor,
              currency: input.currency,
            },
          },
          transaction,
        );
        return updated;
      });
      return { intent };
    } catch (error) {
      const message = this.message(error);
      await this.repository.updateIntent(created.intent.id, { lastError: message });
      await this.audit.record({
        ...context,
        action: 'payment.intent_create_failed',
        resourceType: 'payment_intent',
        resourceId: created.intent.id,
        outcome: 'failure',
        metadata: { provider, merchantOrderId: input.merchantOrderId, error: message },
      });
      throw new ApiError(502, 'PAYMENT_PROVIDER_CREATE_FAILED', 'Payment provider request failed');
    }
  }

  async list(query: PaymentIntentQuery) {
    const result = await this.repository.searchIntents(query);
    return {
      items: result.items,
      meta: paginationMeta({ page: query.page, pageSize: query.pageSize, total: result.total }),
    };
  }

  async get(id: string) {
    const intent = await this.repository.findIntentById(id);
    if (!intent) throw new ApiError(404, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent not found');
    return intent;
  }

  async query(id: string, context: AuditContext) {
    const intent = await this.get(id);
    const result = await this.adapters.forProvider(intent.provider as PaymentProvider).query({
      merchantOrderId: intent.merchantOrderId,
      providerTransactionId: intent.providerTransactionId,
    });
    const updated = await this.repository.transaction((transaction) =>
      this.applyPaymentResult(intent.id, result, transaction),
    );
    await this.audit.record({
      ...context,
      action: 'payment.intent_queried',
      resourceType: 'payment_intent',
      resourceId: id,
      metadata: { provider: intent.provider, status: updated.status },
    });
    return { intent: updated };
  }

  async close(id: string, context: AuditContext & { actorId: string }) {
    const intent = await this.get(id);
    if (!['created', 'pending'].includes(intent.status)) {
      throw new ApiError(409, 'PAYMENT_INTENT_NOT_CLOSABLE', 'Payment intent cannot be closed');
    }
    const result = await this.adapters.forProvider(intent.provider as PaymentProvider).close({
      merchantOrderId: intent.merchantOrderId,
      providerTransactionId: intent.providerTransactionId,
    });
    const updated = await this.repository.transaction((transaction) =>
      this.applyPaymentResult(intent.id, result, transaction),
    );
    await this.audit.record({
      ...context,
      action: 'payment.intent_closed',
      resourceType: 'payment_intent',
      resourceId: id,
      metadata: { provider: intent.provider },
    });
    return { intent: updated };
  }

  async mockSucceed(id: string, context: AuditContext & { actorId: string }) {
    const intent = await this.get(id);
    this.settings.ensureProviderAllowed('mock');
    if (intent.provider !== 'mock') {
      throw new ApiError(409, 'PAYMENT_INTENT_NOT_MOCK', 'Payment intent is not using Mock');
    }
    const updated = await this.repository.transaction((transaction) =>
      this.applyPaymentResult(
        id,
        {
          status: 'succeeded',
          providerTransactionId: `mock:${intent.merchantOrderId}`,
          paidAt: new Date(),
        },
        transaction,
      ),
    );
    await this.audit.record({
      ...context,
      action: 'payment.mock_succeeded',
      resourceType: 'payment_intent',
      resourceId: id,
      metadata: { merchantOrderId: intent.merchantOrderId },
    });
    return { intent: updated };
  }

  async refund(
    id: string,
    input: CreatePaymentRefundRequest,
    context: AuditContext & { actorId: string },
  ) {
    const prepared = await this.repository.transaction(async (transaction) => {
      const intent = await this.repository.lockIntentById(id, transaction);
      if (!intent) throw new ApiError(404, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent not found');
      if (!['succeeded', 'partially_refunded'].includes(intent.status)) {
        throw new ApiError(
          409,
          'PAYMENT_INTENT_NOT_REFUNDABLE',
          'Payment intent is not refundable',
        );
      }
      const reserved = await this.repository.reservedRefundAmount(id, transaction);
      if (reserved + input.amountMinor > intent.amountMinor) {
        throw new ApiError(
          409,
          'PAYMENT_REFUND_EXCEEDS_AVAILABLE',
          'Refund exceeds available amount',
        );
      }
      const created = await this.repository.createRefund(
        {
          paymentIntentId: id,
          merchantRefundId: input.merchantRefundId,
          amountMinor: input.amountMinor,
          reason: input.reason ?? null,
          createdBy: context.actorId,
        },
        transaction,
      );
      if (!created.created) this.assertSameRefund(created.refund, id, input);
      if (created.created) {
        await this.jobs.enqueue(
          {
            type: 'payment.refund-reconcile',
            payload: { paymentRefundId: created.refund.id },
            runAt: new Date(Date.now() + 30_000),
            maxAttempts: 10,
            idempotencyKey: `payment-refund-reconcile:${created.refund.id}`,
          },
          transaction,
        );
      }
      return { intent, ...created };
    });
    if (!prepared.created) return { refund: prepared.refund };

    try {
      const result = await this.adapters
        .forProvider(prepared.intent.provider as PaymentProvider)
        .refund({
          merchantOrderId: prepared.intent.merchantOrderId,
          providerTransactionId: prepared.intent.providerTransactionId,
          merchantRefundId: prepared.refund.merchantRefundId,
          amountMinor: prepared.refund.amountMinor,
          totalAmountMinor: prepared.intent.amountMinor,
          currency: 'CNY',
          reason: prepared.refund.reason,
        });
      const refund = await this.repository.transaction(async (transaction) => {
        const updated = await this.applyRefundResult(prepared.refund.id, result, transaction);
        await this.audit.record(
          {
            ...context,
            action: 'payment.refund_requested',
            resourceType: 'payment_refund',
            resourceId: updated.id,
            metadata: {
              paymentIntentId: id,
              amountMinor: updated.amountMinor,
              status: updated.status,
            },
          },
          transaction,
        );
        return updated;
      });
      return { refund };
    } catch (error) {
      const message = this.message(error);
      const refund = await this.repository.updateRefund(prepared.refund.id, {
        lastError: message,
      });
      if (!refund) throw error;
      await this.audit.record({
        ...context,
        action: 'payment.refund_failed',
        resourceType: 'payment_refund',
        resourceId: refund.id,
        outcome: 'failure',
        metadata: { paymentIntentId: id, error: message },
      });
      throw new ApiError(502, 'PAYMENT_PROVIDER_REFUND_FAILED', 'Payment refund request failed');
    }
  }

  async listRefunds(query: PaymentRefundQuery) {
    const result = await this.repository.searchRefunds(query);
    return {
      items: result.items,
      meta: paginationMeta({ page: query.page, pageSize: query.pageSize, total: result.total }),
    };
  }

  async queryRefund(id: string, context: AuditContext) {
    const refund = await this.repository.findRefundById(id);
    if (!refund) throw new ApiError(404, 'PAYMENT_REFUND_NOT_FOUND', 'Payment refund not found');
    const intent = await this.get(refund.paymentIntentId);
    const result = await this.adapters.forProvider(intent.provider as PaymentProvider).queryRefund({
      merchantOrderId: intent.merchantOrderId,
      merchantRefundId: refund.merchantRefundId,
      providerRefundId: refund.providerRefundId,
    });
    const updated = await this.repository.transaction((transaction) =>
      this.applyRefundResult(refund.id, result, transaction),
    );
    await this.audit.record({
      ...context,
      action: 'payment.refund_queried',
      resourceType: 'payment_refund',
      resourceId: id,
      metadata: { paymentIntentId: intent.id, status: updated.status },
    });
    return { refund: updated };
  }

  async callback(
    provider: 'alipay' | 'wechat',
    input: {
      headers: Record<string, string | string[] | undefined>;
      rawBody: string;
      parsedBody: unknown;
    },
    context: AuditContext,
  ) {
    const event = await this.adapters.forProvider(provider).verifyCallback(input);
    const bodySha256 = createHash('sha256').update(input.rawBody).digest('hex');
    const received = await this.repository.createCallback({
      provider,
      eventId: event.eventId,
      eventType: event.eventType,
      bodySha256,
    });
    if (!received.created) {
      if (received.callback.bodySha256 !== bodySha256) {
        throw new ApiError(409, 'PAYMENT_CALLBACK_REPLAY_MISMATCH', 'Callback replay body changed');
      }
      if (received.callback.status === 'processed') return { accepted: true as const };
      throw new ApiError(
        409,
        'PAYMENT_CALLBACK_IN_PROGRESS',
        'Callback is already being processed',
      );
    }

    try {
      await this.repository.transaction(async (transaction) => {
        const applied = await this.applyCallback(provider, event, transaction);
        await this.repository.completeCallback(
          received.callback.id,
          {
            paymentIntentId: applied.paymentIntentId,
            paymentRefundId: applied.paymentRefundId,
          },
          transaction,
        );
        await this.audit.record(
          {
            ...context,
            actorType: 'provider',
            actorId: provider,
            action: 'payment.callback_processed',
            resourceType: 'payment_callback',
            resourceId: received.callback.id,
            metadata: {
              provider,
              eventId: event.eventId,
              eventType: event.eventType,
              paymentIntentId: applied.paymentIntentId,
              paymentRefundId: applied.paymentRefundId,
            },
          },
          transaction,
        );
      });
      return { accepted: true as const };
    } catch (error) {
      await this.repository.rejectCallback(received.callback.id, this.message(error));
      throw error;
    }
  }

  async reconcileIntent(id: string, context: AuditContext) {
    const intent = await this.get(id);
    if (!['created', 'pending'].includes(intent.status)) return { intent };
    const adapter = this.adapters.forProvider(intent.provider as PaymentProvider);
    const result =
      intent.status === 'created'
        ? await adapter.create({
            paymentIntentId: intent.id,
            merchantOrderId: intent.merchantOrderId,
            subject: intent.subject,
            description: intent.description,
            amountMinor: intent.amountMinor,
            currency: 'CNY',
            expiresAt: intent.expiresAt,
          })
        : await adapter.query({
            merchantOrderId: intent.merchantOrderId,
            providerTransactionId: intent.providerTransactionId,
          });
    const updated = await this.repository.transaction((transaction) =>
      this.applyPaymentResult(intent.id, result, transaction),
    );
    await this.audit.record({
      ...context,
      action: 'payment.intent_reconciled',
      resourceType: 'payment_intent',
      resourceId: id,
      metadata: { provider: intent.provider, status: updated.status },
    });
    return { intent: updated };
  }

  async reconcileRefund(id: string, context: AuditContext) {
    const refund = await this.repository.findRefundById(id);
    if (!refund) throw new ApiError(404, 'PAYMENT_REFUND_NOT_FOUND', 'Payment refund not found');
    if (refund.status !== 'pending') return { refund };
    const intent = await this.get(refund.paymentIntentId);
    const result = await this.adapters.forProvider(intent.provider as PaymentProvider).refund({
      merchantOrderId: intent.merchantOrderId,
      providerTransactionId: intent.providerTransactionId,
      merchantRefundId: refund.merchantRefundId,
      amountMinor: refund.amountMinor,
      totalAmountMinor: intent.amountMinor,
      currency: 'CNY',
      reason: refund.reason,
    });
    const updated = await this.repository.transaction((transaction) =>
      this.applyRefundResult(refund.id, result, transaction),
    );
    await this.audit.record({
      ...context,
      action: 'payment.refund_reconciled',
      resourceType: 'payment_refund',
      resourceId: id,
      metadata: { paymentIntentId: intent.id, status: updated.status },
    });
    return { refund: updated };
  }

  async closeExpired(id: string, context: AuditContext) {
    const intent = await this.get(id);
    if (!['created', 'pending'].includes(intent.status) || intent.expiresAt > new Date()) {
      return { intent };
    }
    const result = await this.adapters.forProvider(intent.provider as PaymentProvider).close({
      merchantOrderId: intent.merchantOrderId,
      providerTransactionId: intent.providerTransactionId,
    });
    const updated = await this.repository.transaction((transaction) =>
      this.applyPaymentResult(id, result, transaction),
    );
    await this.audit.record({
      ...context,
      action: 'payment.intent_expired_closed',
      resourceType: 'payment_intent',
      resourceId: id,
      metadata: { provider: intent.provider },
    });
    return { intent: updated };
  }

  private async applyCallback(
    provider: 'alipay' | 'wechat',
    event: VerifiedProviderCallback,
    transaction: DatabaseExecutor,
  ) {
    const intent = await this.repository.lockIntentByMerchantOrderId(
      event.merchantOrderId,
      transaction,
    );
    if (!intent) throw new ApiError(404, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent not found');
    if (intent.provider !== provider) {
      throw new ApiError(409, 'PAYMENT_PROVIDER_MISMATCH', 'Payment provider does not match');
    }
    if (
      intent.currency !== event.currency ||
      ('merchantRefundId' in event ? false : intent.amountMinor !== event.amountMinor)
    ) {
      throw new ApiError(
        409,
        'PAYMENT_AMOUNT_MISMATCH',
        'Payment amount or currency does not match',
      );
    }
    if ('merchantRefundId' in event) {
      const refund = await this.repository.lockRefundByMerchantRefundId(
        event.merchantRefundId,
        transaction,
      );
      if (!refund || refund.paymentIntentId !== intent.id) {
        throw new ApiError(404, 'PAYMENT_REFUND_NOT_FOUND', 'Payment refund not found');
      }
      if (refund.amountMinor !== event.amountMinor) {
        throw new ApiError(409, 'PAYMENT_REFUND_AMOUNT_MISMATCH', 'Refund amount does not match');
      }
      const updated = await this.applyRefundResult(
        refund.id,
        {
          status: event.status,
          providerRefundId: event.providerRefundId,
          refundedAt: event.status === 'succeeded' ? event.occurredAt : null,
        },
        transaction,
      );
      return { paymentIntentId: intent.id, paymentRefundId: updated.id };
    }
    await this.applyPaymentResult(
      intent.id,
      {
        status: event.status,
        providerTransactionId: event.providerTransactionId,
        paidAt: event.status === 'succeeded' ? event.occurredAt : null,
      },
      transaction,
    );
    return { paymentIntentId: intent.id, paymentRefundId: null };
  }

  private async applyPaymentResult(
    id: string,
    result: ProviderPaymentResult,
    transaction: DatabaseExecutor,
  ) {
    const current = await this.repository.lockIntentById(id, transaction);
    if (!current) throw new ApiError(404, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent not found');
    if (!canTransitionPayment(current.status as PaymentIntentStatus, result.status)) {
      throw new ApiError(
        409,
        'PAYMENT_STATE_TRANSITION_INVALID',
        'Payment state transition is invalid',
      );
    }
    if (
      current.providerTransactionId &&
      result.providerTransactionId &&
      current.providerTransactionId !== result.providerTransactionId
    ) {
      throw new ApiError(
        409,
        'PAYMENT_TRANSACTION_MISMATCH',
        'Provider transaction ID does not match',
      );
    }
    const updated = await this.repository.updateIntent(
      id,
      {
        status: result.status,
        providerTransactionId: result.providerTransactionId ?? current.providerTransactionId,
        checkoutUrl: result.checkoutUrl ?? current.checkoutUrl,
        paidAt: result.paidAt ?? current.paidAt,
        closedAt: result.status === 'closed' ? new Date() : current.closedAt,
        lastError: result.error ?? null,
      },
      transaction,
    );
    if (!updated) throw new Error('Failed to update payment intent');
    if (updated.status === 'succeeded') {
      await this.outbox.append(
        {
          topic: 'payments.succeeded',
          aggregateType: 'payment_intent',
          aggregateId: updated.id,
          payload: {
            paymentIntentId: updated.id,
            merchantOrderId: updated.merchantOrderId,
            provider: updated.provider,
            providerTransactionId: updated.providerTransactionId,
            amountMinor: updated.amountMinor,
            currency: updated.currency,
          },
          dedupeKey: `payment-succeeded:${updated.id}`,
        },
        transaction,
      );
    }
    return updated;
  }

  private async applyRefundResult(
    id: string,
    result: ProviderRefundResult,
    transaction: DatabaseExecutor,
  ) {
    const current = await this.repository.lockRefundById(id, transaction);
    if (!current) throw new ApiError(404, 'PAYMENT_REFUND_NOT_FOUND', 'Payment refund not found');
    if (current.status === 'succeeded' && result.status !== 'succeeded') return current;
    if (
      current.providerRefundId &&
      result.providerRefundId &&
      current.providerRefundId !== result.providerRefundId
    ) {
      throw new ApiError(409, 'PAYMENT_REFUND_ID_MISMATCH', 'Provider refund ID does not match');
    }
    const updated = await this.repository.updateRefund(
      id,
      {
        status: result.status,
        providerRefundId: result.providerRefundId ?? current.providerRefundId,
        refundedAt: result.refundedAt ?? current.refundedAt,
        lastError: result.error ?? null,
      },
      transaction,
    );
    if (!updated) throw new Error('Failed to update payment refund');
    if (current.status !== 'succeeded' && updated.status === 'succeeded') {
      const intent = await this.repository.lockIntentById(updated.paymentIntentId, transaction);
      if (!intent) throw new Error('Payment intent for refund not found');
      const refundedAmountMinor = intent.refundedAmountMinor + updated.amountMinor;
      const status = refundedPaymentStatus(intent.amountMinor, refundedAmountMinor);
      await this.repository.updateIntent(intent.id, { refundedAmountMinor, status }, transaction);
      await this.outbox.append(
        {
          topic: 'payments.refunded',
          aggregateType: 'payment_refund',
          aggregateId: updated.id,
          payload: {
            paymentIntentId: intent.id,
            paymentRefundId: updated.id,
            merchantOrderId: intent.merchantOrderId,
            merchantRefundId: updated.merchantRefundId,
            amountMinor: updated.amountMinor,
            currency: intent.currency,
          },
          dedupeKey: `payment-refunded:${updated.id}`,
        },
        transaction,
      );
    }
    return updated;
  }

  private assertSameIntent(
    existing: PaymentIntentRecord,
    input: CreatePaymentIntentRequest,
    provider: PaymentProvider,
  ) {
    if (
      existing.provider !== provider ||
      existing.amountMinor !== input.amountMinor ||
      existing.currency !== input.currency ||
      existing.subject !== input.subject
    ) {
      throw new ApiError(
        409,
        'PAYMENT_IDEMPOTENCY_CONFLICT',
        'Merchant order ID already exists with different payment data',
      );
    }
  }

  private assertSameRefund(
    existing: PaymentRefundRecord,
    paymentIntentId: string,
    input: CreatePaymentRefundRequest,
  ) {
    if (
      existing.paymentIntentId !== paymentIntentId ||
      existing.amountMinor !== input.amountMinor
    ) {
      throw new ApiError(
        409,
        'PAYMENT_REFUND_IDEMPOTENCY_CONFLICT',
        'Merchant refund ID already exists with different refund data',
      );
    }
  }

  private message(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 10_000);
  }
}
