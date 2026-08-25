import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../src/modules/audit/public';
import type { JobsService } from '../../src/modules/jobs/public';
import type { OutboxService } from '../../src/modules/outbox/public';
import { PaymentSettingsService } from '../../src/modules/payments/application/payment-settings.service';
import { PaymentsService } from '../../src/modules/payments/application/payments.service';
import type { PaymentAdapterFactory } from '../../src/modules/payments/infrastructure/adapters/payment-adapter.factory';
import type { PaymentsRepository } from '../../src/modules/payments/infrastructure/persistence/payments.repository';

const context = {
  actorType: 'user' as const,
  actorId: 'fdda765f-fc57-5604-a269-52a7df8164ec',
  requestId: 'payment-test',
};

const now = new Date('2026-08-25T08:00:00Z');
const intent = {
  id: '9f2148c5-7ddb-4b17-85f7-700eab5ba697',
  provider: 'mock',
  merchantOrderId: 'order-1',
  providerTransactionId: null,
  subject: 'Service fee',
  description: null,
  amountMinor: 10_000,
  refundedAmountMinor: 0,
  currency: 'CNY',
  status: 'created',
  checkoutUrl: null,
  metadata: {},
  expiresAt: new Date('2026-08-25T08:30:00Z'),
  paidAt: null,
  closedAt: null,
  createdBy: context.actorId,
  lastError: null,
  version: 1,
  createdAt: now,
  updatedAt: now,
};

function harness() {
  const transaction = {};
  const repository = {
    transaction: vi.fn(async (operation: (executor: unknown) => Promise<unknown>) =>
      operation(transaction),
    ),
    createIntent: vi.fn().mockResolvedValue({ intent, created: true }),
    lockIntentById: vi.fn().mockResolvedValue(intent),
    lockIntentByMerchantOrderId: vi.fn().mockResolvedValue(intent),
    updateIntent: vi.fn().mockImplementation(async (_id, input) => ({ ...intent, ...input })),
    findIntentById: vi.fn().mockResolvedValue(intent),
    reservedRefundAmount: vi.fn().mockResolvedValue(0),
    createRefund: vi.fn(),
    findRefundById: vi.fn(),
    createCallback: vi.fn(),
    completeCallback: vi.fn(),
    rejectCallback: vi.fn(),
  } as unknown as PaymentsRepository;
  const adapter = {
    create: vi.fn().mockResolvedValue({ status: 'pending', checkoutUrl: '/checkout' }),
    query: vi.fn(),
    close: vi.fn(),
    refund: vi.fn(),
    queryRefund: vi.fn(),
    verifyCallback: vi.fn(),
  };
  const adapters = {
    forProvider: vi.fn().mockReturnValue(adapter),
  } as unknown as PaymentAdapterFactory;
  const settings = {
    provider: vi.fn().mockResolvedValue('mock'),
    ensureProviderAllowed: vi.fn(),
  } as unknown as PaymentSettingsService;
  const jobs = { enqueue: vi.fn().mockResolvedValue({}) } as unknown as JobsService;
  const outbox = { append: vi.fn().mockResolvedValue({}) } as unknown as OutboxService;
  const audit = { record: vi.fn().mockResolvedValue({}) } as unknown as AuditService;
  return {
    service: new PaymentsService(repository, adapters, settings, jobs, outbox, audit),
    repository,
    adapter,
    jobs,
    outbox,
    audit,
    transaction,
  };
}

describe('PaymentsService', () => {
  it('atomically schedules compensation and expiry jobs when creating an intent', async () => {
    const { service, jobs, adapter, transaction } = harness();
    await expect(
      service.create(
        {
          merchantOrderId: 'order-1',
          subject: 'Service fee',
          amountMinor: 10_000,
          currency: 'CNY',
          expiresInSeconds: 1_800,
          metadata: {},
        },
        context,
      ),
    ).resolves.toMatchObject({ intent: { status: 'pending', checkoutUrl: '/checkout' } });

    expect(adapter.create).toHaveBeenCalledOnce();
    expect(jobs.enqueue).toHaveBeenCalledTimes(2);
    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payment.reconcile',
        idempotencyKey: `payment-reconcile:${intent.id}`,
      }),
      transaction,
    );
    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payment.close-expired',
        idempotencyKey: `payment-close:${intent.id}`,
      }),
      transaction,
    );
  });

  it('rejects conflicting reuse of a merchant order ID before contacting the provider', async () => {
    const { service, repository, adapter } = harness();
    vi.mocked(repository.createIntent).mockResolvedValue({
      intent: { ...intent, amountMinor: 20_000 },
      created: false,
    } as never);

    await expect(
      service.create(
        {
          merchantOrderId: 'order-1',
          subject: 'Service fee',
          amountMinor: 10_000,
          currency: 'CNY',
          expiresInSeconds: 1_800,
          metadata: {},
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'PAYMENT_IDEMPOTENCY_CONFLICT' });
    expect(adapter.create).not.toHaveBeenCalled();
  });

  it('rejects refund over-allocation while holding the payment lock', async () => {
    const { service, repository, adapter } = harness();
    vi.mocked(repository.lockIntentById).mockResolvedValue({
      ...intent,
      status: 'succeeded',
    } as never);
    vi.mocked(repository.reservedRefundAmount).mockResolvedValue(9_000);

    await expect(
      service.refund(intent.id, { merchantRefundId: 'refund-1', amountMinor: 2_000 }, context),
    ).rejects.toMatchObject({ code: 'PAYMENT_REFUND_EXCEEDS_AVAILABLE' });
    expect(adapter.refund).not.toHaveBeenCalled();
  });

  it('rejects callback amount mismatches and marks the callback retryable', async () => {
    const { service, repository, adapter, outbox } = harness();
    vi.mocked(repository.lockIntentByMerchantOrderId).mockResolvedValue({
      ...intent,
      provider: 'alipay',
    } as never);
    vi.mocked(adapter.verifyCallback).mockResolvedValue({
      eventId: 'event-1',
      eventType: 'TRADE_SUCCESS',
      merchantOrderId: 'order-1',
      providerTransactionId: 'trade-1',
      status: 'succeeded',
      amountMinor: 9_999,
      currency: 'CNY',
      occurredAt: now,
    });
    vi.mocked(repository.createCallback).mockResolvedValue({
      created: true,
      callback: { id: 'callback-1', bodySha256: 'unused', status: 'received' },
    } as never);

    await expect(
      service.callback(
        'alipay',
        { headers: {}, rawBody: 'signed-body', parsedBody: {} },
        { actorType: 'provider', requestId: 'callback-request' },
      ),
    ).rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH' });
    expect(repository.rejectCallback).toHaveBeenCalledWith(
      'callback-1',
      'Payment amount or currency does not match',
    );
    expect(outbox.append).not.toHaveBeenCalled();
  });

  it('accepts a processed callback replay without duplicating state or Outbox events', async () => {
    const { service, repository, adapter, outbox } = harness();
    vi.mocked(adapter.verifyCallback).mockResolvedValue({
      eventId: 'event-2',
      eventType: 'TRADE_SUCCESS',
      merchantOrderId: 'order-1',
      providerTransactionId: 'trade-1',
      status: 'succeeded',
      amountMinor: 10_000,
      currency: 'CNY',
      occurredAt: now,
    });
    const bodySha256 = await import('node:crypto').then(({ createHash }) =>
      createHash('sha256').update('signed-body').digest('hex'),
    );
    vi.mocked(repository.createCallback).mockResolvedValue({
      created: false,
      callback: { id: 'callback-2', bodySha256, status: 'processed' },
    } as never);

    await expect(
      service.callback(
        'alipay',
        { headers: {}, rawBody: 'signed-body', parsedBody: {} },
        { actorType: 'provider', requestId: 'callback-request' },
      ),
    ).resolves.toEqual({ accepted: true });
    expect(repository.transaction).not.toHaveBeenCalled();
    expect(outbox.append).not.toHaveBeenCalled();
  });
});

describe('PaymentSettingsService', () => {
  it('forbids the Mock provider in production', () => {
    const service = new PaymentSettingsService(
      new ConfigService({ NODE_ENV: 'production' }),
      { register: vi.fn() } as never,
      { getValue: vi.fn() } as never,
    );
    expect(() => service.ensureProviderAllowed('mock')).toThrow(
      'Mock payment provider is disabled in production',
    );
    expect(() => service.ensureProviderAllowed('alipay')).not.toThrow();
  });
});
