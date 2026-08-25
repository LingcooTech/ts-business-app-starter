import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/public';
import { JobsModule } from '../jobs/public';
import { OutboxModule } from '../outbox/public';
import { SettingsModule } from '../settings/public';
import { PaymentsController } from './api/payments.controller';
import { PaymentConnectionTestRegistrar } from './application/payment-connection-test.registrar';
import { PaymentJobHandler } from './application/payment-job.handler';
import { PaymentOutboxHandler } from './application/payment-outbox.handler';
import { PaymentSettingsService } from './application/payment-settings.service';
import { PaymentsService } from './application/payments.service';
import { AlipayPaymentAdapter } from './infrastructure/adapters/alipay-payment.adapter';
import { MockPaymentAdapter } from './infrastructure/adapters/mock-payment.adapter';
import { PaymentAdapterFactory } from './infrastructure/adapters/payment-adapter.factory';
import { WechatPaymentAdapter } from './infrastructure/adapters/wechat-payment.adapter';
import { PaymentsRepository } from './infrastructure/persistence/payments.repository';

@Module({
  imports: [AuditModule, JobsModule, OutboxModule, SettingsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsRepository,
    PaymentSettingsService,
    MockPaymentAdapter,
    AlipayPaymentAdapter,
    WechatPaymentAdapter,
    PaymentAdapterFactory,
    PaymentsService,
    PaymentJobHandler,
    PaymentOutboxHandler,
    PaymentConnectionTestRegistrar,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
