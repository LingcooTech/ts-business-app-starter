import { describe, expect, it, vi } from 'vitest';

import { MockPaymentAdapter } from './mock-payment.adapter';

describe('MockPaymentAdapter', () => {
  it('delegates production safety to payment settings before every operation', async () => {
    const settings = {
      ensureProviderAllowed: vi.fn(() => {
        throw new Error('disabled');
      }),
    };
    const adapter = new MockPaymentAdapter(settings as never);

    await expect(adapter.query()).rejects.toThrow('disabled');
    expect(settings.ensureProviderAllowed).toHaveBeenCalledWith('mock');
  });
});
