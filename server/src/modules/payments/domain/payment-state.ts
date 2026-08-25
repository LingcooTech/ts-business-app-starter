import type { PaymentIntentStatus } from '@ts-business-app-starter/contracts';

const TRANSITIONS: Record<PaymentIntentStatus, ReadonlySet<PaymentIntentStatus>> = {
  created: new Set(['created', 'pending', 'succeeded', 'closed', 'failed']),
  pending: new Set(['pending', 'succeeded', 'closed', 'failed']),
  succeeded: new Set(['succeeded', 'partially_refunded', 'refunded']),
  closed: new Set(['closed']),
  failed: new Set(['failed']),
  partially_refunded: new Set(['partially_refunded', 'refunded']),
  refunded: new Set(['refunded']),
};

export function canTransitionPayment(
  current: PaymentIntentStatus,
  next: PaymentIntentStatus,
): boolean {
  return TRANSITIONS[current].has(next);
}

export function refundedPaymentStatus(totalAmountMinor: number, refundedAmountMinor: number) {
  return refundedAmountMinor >= totalAmountMinor ? 'refunded' : 'partially_refunded';
}
