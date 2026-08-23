import { Injectable } from '@nestjs/common';

import { AccessControlRepository } from '../infrastructure/persistence/access-control.repository';

@Injectable()
export class AccessControlService {
  constructor(private readonly repository: AccessControlRepository) {}

  async permissionsForUser(userId: string): Promise<ReadonlySet<string>> {
    return new Set(await this.repository.permissionsForUser(userId));
  }

  async synchronizeSystemPermissions(): Promise<void> {
    await this.repository.synchronizeSystemPermissions();
  }

  async assignOwnerRole(userId: string): Promise<void> {
    await this.repository.assignOwnerRole(userId);
  }
}
