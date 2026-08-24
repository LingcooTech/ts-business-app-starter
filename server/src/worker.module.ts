import { Module } from '@nestjs/common';

import { AppConfigModule } from './infrastructure/config/app-config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { WorkerRunner } from './infrastructure/worker/worker-runner.service';
import { AuditModule } from './modules/audit/public';
import { JobsModule } from './modules/jobs/public';
import { MailModule } from './modules/mail/public';
import { NotificationsModule } from './modules/notifications/public';
import { OutboxModule } from './modules/outbox/public';
import { SettingsModule } from './modules/settings/public';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuditModule,
    SettingsModule,
    JobsModule,
    OutboxModule,
    MailModule,
    NotificationsModule,
  ],
  providers: [WorkerRunner],
})
export class WorkerModule {}
