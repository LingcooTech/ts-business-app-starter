import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/public';
import { JobsController } from './api/jobs.controller';
import { JobHandlerRegistry } from './application/job-handler.registry';
import { JobsService } from './application/jobs.service';
import { RecurringJobRegistry } from './application/recurring-job.registry';
import { JobsRepository } from './infrastructure/persistence/jobs.repository';

@Module({
  imports: [AuditModule],
  controllers: [JobsController],
  providers: [JobHandlerRegistry, JobsRepository, JobsService, RecurringJobRegistry],
  exports: [JobHandlerRegistry, JobsRepository, JobsService, RecurringJobRegistry],
})
export class JobsModule {}
