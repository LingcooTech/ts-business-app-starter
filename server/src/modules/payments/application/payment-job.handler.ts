import { Injectable, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';

import { JobHandlerRegistry } from '../../jobs/public';
import { PaymentsService } from './payments.service';

const intentPayloadSchema = z.object({ paymentIntentId: z.uuid() });
const refundPayloadSchema = z.object({ paymentRefundId: z.uuid() });

@Injectable()
export class PaymentJobHandler implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit(): void {
    this.registry.register('payment.close-expired', async (payload, context) => {
      const { paymentIntentId } = intentPayloadSchema.parse(payload);
      await this.payments.closeExpired(paymentIntentId, {
        actorType: 'job',
        actorId: context.jobId,
      });
    });
    this.registry.register('payment.reconcile', async (payload, context) => {
      const { paymentIntentId } = intentPayloadSchema.parse(payload);
      await this.payments.reconcileIntent(paymentIntentId, {
        actorType: 'job',
        actorId: context.jobId,
      });
    });
    this.registry.register('payment.refund-reconcile', async (payload, context) => {
      const { paymentRefundId } = refundPayloadSchema.parse(payload);
      await this.payments.reconcileRefund(paymentRefundId, {
        actorType: 'job',
        actorId: context.jobId,
      });
    });
  }
}
