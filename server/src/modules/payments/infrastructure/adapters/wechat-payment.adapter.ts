import { Injectable } from '@nestjs/common';
import { Aes, Rsa, Wechatpay } from 'wechatpay-axios-plugin';
import { z } from 'zod';

import { PaymentSettingsService } from '../../application/payment-settings.service';
import type { PaymentProviderPort, ProviderPaymentResult } from '../../domain/payment.types';

const notificationSchema = z.object({
  id: z.string().min(1).max(160),
  event_type: z.string().min(1).max(120),
  resource: z.object({
    ciphertext: z.string().min(1),
    nonce: z.string().min(1),
    associated_data: z.string().default(''),
  }),
});

const transactionSchema = z.object({
  mchid: z.string().min(1),
  appid: z.string().min(1),
  out_trade_no: z.string().min(1),
  transaction_id: z.string().optional(),
  trade_state: z.string().min(1),
  success_time: z.string().optional(),
  amount: z.object({ total: z.number().int().positive(), currency: z.literal('CNY') }),
});

const refundNotificationSchema = z.object({
  mchid: z.string().min(1),
  appid: z.string().min(1).optional(),
  out_trade_no: z.string().min(1),
  out_refund_no: z.string().min(1),
  refund_id: z.string().optional(),
  refund_status: z.string().min(1),
  success_time: z.string().optional(),
  amount: z.object({ refund: z.number().int().positive(), currency: z.literal('CNY') }),
});

@Injectable()
export class WechatPaymentAdapter implements PaymentProviderPort {
  constructor(private readonly settings: PaymentSettingsService) {}

  provider() {
    return 'wechat' as const;
  }

  async create(input: {
    merchantOrderId: string;
    subject: string;
    amountMinor: number;
    expiresAt: Date;
  }) {
    const { client, config } = await this.client();
    const response = await client.request<{ code_url: string }>(
      '/v3/pay/transactions/native',
      'post',
      {
        mchid: config.mchid,
        appid: config.appid,
        description: input.subject,
        out_trade_no: input.merchantOrderId,
        notify_url: config.notifyUrl,
        time_expire: input.expiresAt.toISOString(),
        amount: { total: input.amountMinor, currency: 'CNY' },
      },
    );
    return { status: 'pending' as const, checkoutUrl: response.data.code_url };
  }

  async query(input: { merchantOrderId: string }) {
    const { client, config } = await this.client();
    const response = await client.request<Record<string, unknown>>(
      `/v3/pay/transactions/out-trade-no/${encodeURIComponent(input.merchantOrderId)}`,
      'get',
      undefined,
      { params: { mchid: config.mchid } },
    );
    return this.paymentResult(response.data);
  }

  async close(input: { merchantOrderId: string }) {
    const { client, config } = await this.client();
    await client.request(
      `/v3/pay/transactions/out-trade-no/${encodeURIComponent(input.merchantOrderId)}/close`,
      'post',
      { mchid: config.mchid },
    );
    return { status: 'closed' as const };
  }

  async refund(input: {
    merchantOrderId: string;
    merchantRefundId: string;
    amountMinor: number;
    totalAmountMinor: number;
    reason: string | null;
  }) {
    const { client, config } = await this.client();
    const response = await client.request<Record<string, unknown>>(
      '/v3/refund/domestic/refunds',
      'post',
      {
        out_trade_no: input.merchantOrderId,
        out_refund_no: input.merchantRefundId,
        reason: input.reason ?? undefined,
        notify_url: config.notifyUrl,
        amount: { refund: input.amountMinor, total: input.totalAmountMinor, currency: 'CNY' },
      },
    );
    return this.refundResult(response.data);
  }

  async queryRefund(input: { merchantRefundId: string }) {
    const { client } = await this.client();
    const response = await client.request<Record<string, unknown>>(
      `/v3/refund/domestic/refunds/${encodeURIComponent(input.merchantRefundId)}`,
      'get',
    );
    return this.refundResult(response.data);
  }

  async verifyCallback(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string;
    parsedBody: unknown;
  }) {
    const notification = notificationSchema.parse(input.parsedBody);
    const config = await this.settings.wechatConfig();
    const timestamp = this.header(input.headers, 'wechatpay-timestamp');
    const nonce = this.header(input.headers, 'wechatpay-nonce');
    const signature = this.header(input.headers, 'wechatpay-signature');
    const serial = this.header(input.headers, 'wechatpay-serial');
    const timestampNumber = Number(timestamp);
    if (
      !Number.isInteger(timestampNumber) ||
      Math.abs(Date.now() / 1_000 - timestampNumber) > this.settings.callbackToleranceSeconds()
    ) {
      throw new Error('WeChat Pay callback timestamp is outside the accepted window');
    }
    const certificate = config.certificates[serial];
    if (!certificate) throw new Error('WeChat Pay callback certificate serial is not configured');
    const message = `${timestamp}\n${nonce}\n${input.rawBody}\n`;
    if (!Rsa.verify(message, signature, Rsa.from(certificate, Rsa.KEY_TYPE_PUBLIC))) {
      throw new Error('WeChat Pay callback signature is invalid');
    }
    const plaintext = Aes.AesGcm.decrypt(
      notification.resource.ciphertext,
      config.apiV3Key,
      notification.resource.nonce,
      notification.resource.associated_data,
    );
    const payload: unknown = JSON.parse(plaintext);
    if (notification.event_type.startsWith('REFUND.')) {
      const refund = refundNotificationSchema.parse(payload);
      if (refund.mchid !== config.mchid) throw new Error('WeChat Pay merchant ID does not match');
      if (refund.appid && refund.appid !== config.appid) {
        throw new Error('WeChat Pay app ID does not match');
      }
      return {
        eventId: notification.id,
        eventType: notification.event_type,
        merchantOrderId: refund.out_trade_no,
        merchantRefundId: refund.out_refund_no,
        providerRefundId: refund.refund_id ?? null,
        status: this.refundStatus(refund.refund_status),
        amountMinor: refund.amount.refund,
        currency: refund.amount.currency,
        occurredAt: refund.success_time ? new Date(refund.success_time) : new Date(),
      };
    }
    const transaction = transactionSchema.parse(payload);
    if (transaction.mchid !== config.mchid)
      throw new Error('WeChat Pay merchant ID does not match');
    if (transaction.appid !== config.appid) throw new Error('WeChat Pay app ID does not match');
    return {
      eventId: notification.id,
      eventType: notification.event_type,
      merchantOrderId: transaction.out_trade_no,
      providerTransactionId: transaction.transaction_id ?? null,
      status: this.paymentStatus(transaction.trade_state),
      amountMinor: transaction.amount.total,
      currency: transaction.amount.currency,
      occurredAt: transaction.success_time ? new Date(transaction.success_time) : new Date(),
    };
  }

  async test(): Promise<void> {
    const config = await this.settings.wechatConfig();
    const privateKey = Rsa.from(config.privateKey, Rsa.KEY_TYPE_PRIVATE);
    Rsa.sign('payment-connection-test', privateKey);
    for (const certificate of Object.values(config.certificates)) {
      Rsa.from(certificate, Rsa.KEY_TYPE_PUBLIC);
    }
  }

  private async client() {
    const config = await this.settings.wechatConfig();
    const certs = Object.fromEntries(
      Object.entries(config.certificates).map(([serial, certificate]) => [
        serial,
        Rsa.from(certificate, Rsa.KEY_TYPE_PUBLIC),
      ]),
    );
    return {
      config,
      client: new Wechatpay({
        mchid: config.mchid,
        serial: config.serial,
        privateKey: config.privateKey,
        certs,
        baseURL: 'https://api.mch.weixin.qq.com',
        timeout: 10_000,
      }).client,
    };
  }

  private paymentResult(result: Record<string, unknown>): ProviderPaymentResult {
    const tradeState = String(result.trade_state ?? result.tradeState ?? 'NOTPAY');
    return {
      status: this.paymentStatus(tradeState),
      providerTransactionId: result.transaction_id ? String(result.transaction_id) : null,
      paidAt: tradeState === 'SUCCESS' ? new Date() : null,
    };
  }

  private refundResult(result: Record<string, unknown>) {
    const status = this.refundStatus(String(result.status ?? 'PROCESSING'));
    return {
      status,
      providerRefundId: result.refund_id ? String(result.refund_id) : null,
      refundedAt: status === 'succeeded' ? new Date() : null,
    };
  }

  private paymentStatus(status: string): ProviderPaymentResult['status'] {
    if (status === 'SUCCESS') return 'succeeded';
    if (status === 'CLOSED' || status === 'REVOKED' || status === 'PAYERROR') return 'closed';
    return 'pending';
  }

  private refundStatus(status: string) {
    if (status === 'SUCCESS') return 'succeeded' as const;
    if (status === 'CLOSED' || status === 'ABNORMAL') return 'failed' as const;
    return 'pending' as const;
  }

  private header(headers: Record<string, string | string[] | undefined>, name: string) {
    const value = headers[name];
    const resolved = Array.isArray(value) ? value[0] : value;
    if (!resolved) throw new Error(`Missing ${name} header`);
    return resolved;
  }
}
