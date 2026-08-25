import { AlipaySdk } from 'alipay-sdk';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { PaymentSettingsService } from '../../application/payment-settings.service';
import type { PaymentProviderPort, ProviderPaymentResult } from '../../domain/payment.types';

const callbackSchema = z.record(z.string(), z.string());

@Injectable()
export class AlipayPaymentAdapter implements PaymentProviderPort {
  constructor(private readonly settings: PaymentSettingsService) {}

  provider() {
    return 'alipay' as const;
  }

  async create(input: {
    merchantOrderId: string;
    subject: string;
    description: string | null;
    amountMinor: number;
  }) {
    const { sdk, config } = await this.sdk();
    return {
      status: 'pending' as const,
      checkoutUrl: sdk.pageExecute('alipay.trade.page.pay', 'GET', {
        notifyUrl: config.notifyUrl,
        returnUrl: config.returnUrl,
        bizContent: {
          out_trade_no: input.merchantOrderId,
          product_code: 'FAST_INSTANT_TRADE_PAY',
          subject: input.subject,
          body: input.description ?? undefined,
          total_amount: this.amount(input.amountMinor),
        },
      }),
    };
  }

  async query(input: { merchantOrderId: string }) {
    const { sdk } = await this.sdk();
    const result = await sdk.exec('alipay.trade.query', {
      bizContent: { out_trade_no: input.merchantOrderId },
    });
    return this.paymentResult(result);
  }

  async close(input: { merchantOrderId: string }) {
    const { sdk } = await this.sdk();
    await sdk.exec('alipay.trade.close', {
      bizContent: { out_trade_no: input.merchantOrderId },
    });
    return { status: 'closed' as const };
  }

  async refund(input: {
    merchantOrderId: string;
    merchantRefundId: string;
    amountMinor: number;
    reason: string | null;
  }) {
    const { sdk } = await this.sdk();
    const result = await sdk.exec('alipay.trade.refund', {
      bizContent: {
        out_trade_no: input.merchantOrderId,
        out_request_no: input.merchantRefundId,
        refund_amount: this.amount(input.amountMinor),
        refund_reason: input.reason ?? undefined,
      },
    });
    return {
      status: 'succeeded' as const,
      providerRefundId: String(result.tradeNo ?? result.outRequestNo ?? input.merchantRefundId),
      refundedAt: new Date(),
    };
  }

  async queryRefund(input: { merchantOrderId: string; merchantRefundId: string }) {
    const { sdk } = await this.sdk();
    const result = await sdk.exec('alipay.trade.fastpay.refund.query', {
      bizContent: {
        out_trade_no: input.merchantOrderId,
        out_request_no: input.merchantRefundId,
      },
    });
    const succeeded = String(result.refundStatus ?? 'REFUND_SUCCESS') === 'REFUND_SUCCESS';
    return {
      status: succeeded ? ('succeeded' as const) : ('pending' as const),
      providerRefundId: String(result.tradeNo ?? input.merchantRefundId),
      refundedAt: succeeded ? new Date() : null,
    };
  }

  async verifyCallback(input: { parsedBody: unknown }) {
    const payload = callbackSchema.parse(input.parsedBody);
    const { sdk, config } = await this.sdk();
    if (!sdk.checkNotifySignV2(payload)) throw new Error('Alipay callback signature is invalid');
    if (payload.app_id !== config.appId) throw new Error('Alipay callback app ID does not match');
    if (!payload.out_trade_no) throw new Error('Alipay callback merchant order ID is missing');
    if (!payload.trade_status) throw new Error('Alipay callback trade status is missing');
    if (!payload.total_amount) throw new Error('Alipay callback amount is missing');
    const amountMinor = this.minor(payload.total_amount);
    return {
      eventId: payload.notify_id ?? `${payload.out_trade_no}:${payload.trade_status}`,
      eventType: payload.trade_status,
      merchantOrderId: payload.out_trade_no,
      providerTransactionId: payload.trade_no ?? null,
      status: this.status(payload.trade_status),
      amountMinor,
      currency: 'CNY' as const,
      occurredAt: new Date(),
    };
  }

  async test(): Promise<void> {
    const { sdk, config } = await this.sdk();
    sdk.pageExecute('alipay.trade.page.pay', 'GET', {
      notifyUrl: config.notifyUrl,
      bizContent: {
        out_trade_no: `connection-test-${Date.now()}`,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        subject: 'Connection test',
        total_amount: '0.01',
      },
    });
  }

  private async sdk() {
    const config = await this.settings.alipayConfig();
    return {
      config,
      sdk: new AlipaySdk({
        appId: config.appId,
        privateKey: config.privateKey,
        alipayPublicKey: config.alipayPublicKey,
        gateway: config.gateway,
        signType: 'RSA2',
        camelcase: true,
      }),
    };
  }

  private paymentResult(result: Record<string, unknown>): ProviderPaymentResult {
    return {
      status: this.status(String(result.tradeStatus ?? 'WAIT_BUYER_PAY')),
      providerTransactionId: result.tradeNo ? String(result.tradeNo) : null,
      paidAt: ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(String(result.tradeStatus))
        ? new Date()
        : null,
    };
  }

  private status(status: string | undefined): ProviderPaymentResult['status'] {
    if (status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED') return 'succeeded';
    if (status === 'TRADE_CLOSED') return 'closed';
    return 'pending';
  }

  private amount(minor: number): string {
    return (minor / 100).toFixed(2);
  }

  private minor(amount: string | undefined): number {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed)) throw new Error('Alipay callback amount is invalid');
    return Math.round(parsed * 100);
  }
}
