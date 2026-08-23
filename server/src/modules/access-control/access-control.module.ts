import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { IdentityModule } from '../identity/public';
import { AccessControlController } from './api/access-control.controller';
import { AccessControlGuard } from './api/access-control.guard';
import { AccessControlService } from './application/access-control.service';
import { BootstrapService } from './application/bootstrap.service';
import { AccessControlRepository } from './infrastructure/persistence/access-control.repository';

@Module({
  imports: [IdentityModule],
  controllers: [AccessControlController],
  providers: [
    AccessControlRepository,
    AccessControlService,
    BootstrapService,
    { provide: APP_GUARD, useClass: AccessControlGuard },
  ],
  exports: [AccessControlService, BootstrapService],
})
export class AccessControlModule {}
