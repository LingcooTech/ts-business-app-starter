import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { SettingsRegistry } from '../../settings/public';
import { PaymentAdapterFactory } from '../infrastructure/adapters/payment-adapter.factory';

@Injectable()
export class PaymentConnectionTestRegistrar implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentConnectionTestRegistrar.name);

  constructor(
    private readonly registry: SettingsRegistry,
    private readonly adapters: PaymentAdapterFactory,
  ) {}

  onApplicationBootstrap(): void {
    this.registry.attachTest('payment.provider', async () => {
      try {
        await (await this.adapters.current()).test();
        return { ok: true, message: 'Payment provider configuration succeeded' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Payment provider connection test failed: ${message}`);
        return { ok: false, message: `Payment provider configuration failed: ${message}` };
      }
    });
  }
}
