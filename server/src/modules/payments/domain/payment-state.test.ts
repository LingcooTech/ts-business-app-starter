import { describe, expect, it } from 'vitest';

import { canTransitionPayment, refundedPaymentStatus } from './payment-state';

describe('payment state', () => {
  it('allows provider progress and rejects reopening terminal payments', () => {
    expect(canTransitionPayment('created', 'pending')).toBe(true);
    expect(canTransitionPayment('pending', 'succeeded')).toBe(true);
    expect(canTransitionPayment('succeeded', 'pending')).toBe(false);
    expect(canTransitionPayment('closed', 'succeeded')).toBe(false);
    expect(canTransitionPayment('refunded', 'partially_refunded')).toBe(false);
  });

  it('derives partial and full refund states from integer minor units', () => {
    expect(refundedPaymentStatus(10_000, 4_000)).toBe('partially_refunded');
    expect(refundedPaymentStatus(10_000, 10_000)).toBe('refunded');
  });
});
