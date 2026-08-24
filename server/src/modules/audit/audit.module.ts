import { Module } from '@nestjs/common';

import { AuditController } from './api/audit.controller';
import { AuditService } from './application/audit.service';
import { AuditRepository } from './infrastructure/persistence/audit.repository';

@Module({
  controllers: [AuditController],
  providers: [AuditRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
