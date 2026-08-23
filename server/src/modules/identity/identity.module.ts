import { Module } from '@nestjs/common';

import { IdentityController } from './api/identity.controller';
import { IdentityService } from './application/identity.service';
import { IdentityRepository } from './infrastructure/persistence/identity.repository';

@Module({
  controllers: [IdentityController],
  providers: [IdentityRepository, IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
