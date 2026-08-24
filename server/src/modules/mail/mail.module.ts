import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/public';
import { JobsModule } from '../jobs/public';
import { SettingsModule } from '../settings/public';
import { MailController } from './api/mail.controller';
import { MailJobHandler } from './application/mail-job.handler';
import { MailService } from './application/mail.service';
import { MailSettingsService } from './application/mail-settings.service';
import { MAIL_PORT } from './domain/mail.types';
import { ConfiguredMailAdapter } from './infrastructure/configured-mail.adapter';
import { MailRepository } from './infrastructure/persistence/mail.repository';

@Module({
  imports: [AuditModule, JobsModule, SettingsModule],
  controllers: [MailController],
  providers: [
    MailRepository,
    MailService,
    MailSettingsService,
    ConfiguredMailAdapter,
    { provide: MAIL_PORT, useExisting: ConfiguredMailAdapter },
    MailJobHandler,
  ],
  exports: [MailService],
})
export class MailModule {}
