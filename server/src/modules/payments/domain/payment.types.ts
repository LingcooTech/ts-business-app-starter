import type {
  PaymentIntentStatus,
  PaymentProvider,
  PaymentRefundStatus,
} from '@ts-business-app-starter/contracts';

export type ProviderPaymentResult = {
  status: Extract<PaymentIntentStatus, 'pending' | 'succeeded' | 'closed' | 'failed'>;
  providerTransactionId?: string | null;
  checkoutUrl?: string | null;
  paidAt?: Date | null;
  error?: string | null;
};

export type ProviderRefundResult = {
  status: PaymentRefundStatus;
  providerRefundId?: string | null;
  refundedAt?: Date | null;
  error?: string | null;
};

export type VerifiedPaymentCallback = {
  eventId: string;
  eventType: string;
  merchantOrderId: string;
  providerTransactionId: string | null;
  status: Extract<PaymentIntentStatus, 'pending' | 'succeeded' | 'closed' | 'failed'>;
  amountMinor: number;
  currency: 'CNY';
  occurredAt: Date;
};

export type VerifiedRefundCallback = {
  eventId: string;
  eventType: string;
  merchantOrderId: string;
  merchantRefundId: string;
  providerRefundId: string | null;
  status: PaymentRefundStatus;
  amountMinor: number;
  currency: 'CNY';
  occurredAt: Date;
};

export type VerifiedProviderCallback = VerifiedPaymentCallback | VerifiedRefundCallback;

export interface PaymentProviderPort {
  provider(): PaymentProvider;
  create(input: {
    paymentIntentId: string;
    merchantOrderId: string;
    subject: string;
    description: string | null;
    amountMinor: number;
    currency: 'CNY';
    expiresAt: Date;
  }): Promise<ProviderPaymentResult>;
  query(input: {
    merchantOrderId: string;
    providerTransactionId: string | null;
  }): Promise<ProviderPaymentResult>;
  close(input: {
    merchantOrderId: string;
    providerTransactionId: string | null;
  }): Promise<ProviderPaymentResult>;
  refund(input: {
    merchantOrderId: string;
    providerTransactionId: string | null;
    merchantRefundId: string;
    amountMinor: number;
    totalAmountMinor: number;
    currency: 'CNY';
    reason: string | null;
  }): Promise<ProviderRefundResult>;
  queryRefund(input: {
    merchantOrderId: string;
    merchantRefundId: string;
    providerRefundId: string | null;
  }): Promise<ProviderRefundResult>;
  verifyCallback(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string;
    parsedBody: unknown;
  }): Promise<VerifiedProviderCallback>;
  test(): Promise<void>;
}
