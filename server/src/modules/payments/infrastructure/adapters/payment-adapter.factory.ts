import { Injectable } from '@nestjs/common';

import { PaymentSettingsService } from '../../application/payment-settings.service';
import type { PaymentProviderPort } from '../../domain/payment.types';
import { AlipayPaymentAdapter } from './alipay-payment.adapter';
import { MockPaymentAdapter } from './mock-payment.adapter';
import { WechatPaymentAdapter } from './wechat-payment.adapter';

@Injectable()
export class PaymentAdapterFactory {
  constructor(
    private readonly settings: PaymentSettingsService,
    private readonly mock: MockPaymentAdapter,
    private readonly alipay: AlipayPaymentAdapter,
    private readonly wechat: WechatPaymentAdapter,
  ) {}

  async current(): Promise<PaymentProviderPort> {
    return this.forProvider(await this.settings.provider());
  }

  forProvider(provider: 'mock' | 'alipay' | 'wechat'): PaymentProviderPort {
    if (provider === 'alipay') return this.alipay;
    if (provider === 'wechat') return this.wechat;
    return this.mock;
  }
}
