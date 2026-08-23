import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { emailAddressSchema, passwordSchema } from '@ts-business-app-starter/contracts';

import { IdentityService } from '../../identity/public';
import { AccessControlService } from './access-control.service';

@Injectable()
export class BootstrapService {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly identity: IdentityService,
    private readonly access: AccessControlService,
  ) {}

  async run(): Promise<void> {
    await this.access.synchronizeSystemPermissions();
    this.logger.log('System permissions and Owner role synchronized');

    const configuredEmail = this.config.get<string>('BOOTSTRAP_OWNER_EMAIL')?.trim();
    const configuredPassword = this.config.get<string>('BOOTSTRAP_OWNER_PASSWORD');
    if (!configuredEmail && !configuredPassword) {
      this.logger.log('Owner bootstrap skipped because credentials are not configured');
      return;
    }

    const email = emailAddressSchema.parse(configuredEmail);
    const password = passwordSchema.parse(configuredPassword);
    const owner = await this.identity.ensureBootstrapUser(email, password);
    if (owner.status !== 'active') throw new Error('Configured Owner account is disabled');
    await this.access.assignOwnerRole(owner.id);
    this.logger.log(`Owner role assigned to ${owner.email}`);
  }
}
