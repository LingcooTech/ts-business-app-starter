import { Injectable } from '@nestjs/common';

import type { PaymentProviderPort } from '../../domain/payment.types';
import { PaymentSettingsService } from '../../application/payment-settings.service';

@Injectable()
export class MockPaymentAdapter implements PaymentProviderPort {
  constructor(private readonly settings: PaymentSettingsService) {}

  provider() {
    return 'mock' as const;
  }

  async create(input: { paymentIntentId: string }) {
    await this.ensureAllowed();
    return {
      status: 'pending' as const,
      checkoutUrl: `/admin/payments?intent=${encodeURIComponent(input.paymentIntentId)}`,
    };
  }

  async query() {
    await this.ensureAllowed();
    return { status: 'pending' as const };
  }

  async close() {
    await this.ensureAllowed();
    return { status: 'closed' as const };
  }

  async refund(input: { merchantRefundId: string }) {
    await this.ensureAllowed();
    return {
      status: 'succeeded' as const,
      providerRefundId: `mock-refund:${input.merchantRefundId}`,
      refundedAt: new Date(),
    };
  }

  async queryRefund(input: { providerRefundId: string | null }) {
    await this.ensureAllowed();
    return {
      status: 'succeeded' as const,
      providerRefundId: input.providerRefundId,
      refundedAt: new Date(),
    };
  }

  async verifyCallback(): Promise<never> {
    throw new Error('Mock provider does not accept callbacks');
  }

  async test(): Promise<void> {
    await this.ensureAllowed();
  }

  private async ensureAllowed() {
    this.settings.ensureProviderAllowed('mock');
  }
}
