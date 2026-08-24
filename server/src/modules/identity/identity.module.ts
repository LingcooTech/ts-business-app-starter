import { Module } from '@nestjs/common';

import { MailModule } from '../mail/public';
import { IdentityController } from './api/identity.controller';
import { IdentityService } from './application/identity.service';
import { IdentityRepository } from './infrastructure/persistence/identity.repository';

@Module({
  imports: [MailModule],
  controllers: [IdentityController],
  providers: [IdentityRepository, IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
