import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';

import { AuditService } from '../../audit/public';
import { JobHandlerRegistry } from '../../jobs/public';
import { MAIL_PORT, type MailPort } from '../domain/mail.types';
import { MailRepository } from '../infrastructure/persistence/mail.repository';

const payloadSchema = z.object({ deliveryId: z.uuid() });

@Injectable()
export class MailJobHandler implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly repository: MailRepository,
    private readonly audit: AuditService,
    @Inject(MAIL_PORT) private readonly mailer: MailPort,
  ) {}

  onModuleInit(): void {
    this.registry.register('mail.send', async (payload, context) => {
      const { deliveryId } = payloadSchema.parse(payload);
      const delivery = await this.repository.findById(deliveryId);
      if (!delivery) throw new Error(`Mail delivery not found: ${deliveryId}`);
      if (delivery.status === 'sent') return;
      try {
        const result = await this.mailer.send({
          to: delivery.recipient,
          subject: delivery.subject,
          text: delivery.textBody,
          ...(delivery.htmlBody ? { html: delivery.htmlBody } : {}),
        });
        await this.repository.sent(delivery.id, result.simulated);
        await this.audit.record({
          actorType: 'job',
          actorId: context.jobId,
          action: result.simulated ? 'mail.simulated' : 'mail.sent',
          resourceType: 'mail_delivery',
          resourceId: delivery.id,
          metadata: {
            template: delivery.template,
            recipient: delivery.recipient,
            attempt: context.attempt,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.repository.failed(delivery.id, message.slice(0, 10_000));
        await this.audit.record({
          actorType: 'job',
          actorId: context.jobId,
          action: 'mail.failed',
          resourceType: 'mail_delivery',
          resourceId: delivery.id,
          outcome: 'failure',
          metadata: {
            template: delivery.template,
            recipient: delivery.recipient,
            attempt: context.attempt,
            error: message,
          },
        });
        throw error;
      }
    });
  }
}
