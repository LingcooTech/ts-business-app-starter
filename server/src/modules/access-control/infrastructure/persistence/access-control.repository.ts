import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../../../../common/database/database.port';
import { OWNER_ROLE_KEY, SYSTEM_PERMISSIONS } from '../../domain/system-permissions';
import {
  accessPermissions,
  accessRolePermissions,
  accessRoles,
  accessUserRoles,
} from './access-control.schema';

@Injectable()
export class AccessControlRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async synchronizeSystemPermissions(): Promise<void> {
    await this.database.transaction(async (transaction) => {
      for (const permission of SYSTEM_PERMISSIONS) {
        await transaction
          .insert(accessPermissions)
          .values(permission)
          .onConflictDoUpdate({
            target: accessPermissions.key,
            set: { description: permission.description, updatedAt: new Date() },
          });
      }

      const [role] = await transaction
        .insert(accessRoles)
        .values({ key: OWNER_ROLE_KEY, name: 'Owner', system: true })
        .onConflictDoUpdate({
          target: accessRoles.key,
          set: { name: 'Owner', system: true, updatedAt: new Date() },
        })
        .returning({ id: accessRoles.id });
      if (!role) throw new Error('Failed to synchronize the Owner role');

      await transaction
        .delete(accessRolePermissions)
        .where(eq(accessRolePermissions.roleId, role.id));
      await transaction
        .insert(accessRolePermissions)
        .values(SYSTEM_PERMISSIONS.map(({ key }) => ({ roleId: role.id, permissionKey: key })))
        .onConflictDoNothing();
    });
  }

  async assignOwnerRole(userId: string): Promise<void> {
    const [role] = await this.database
      .select({ id: accessRoles.id })
      .from(accessRoles)
      .where(eq(accessRoles.key, OWNER_ROLE_KEY))
      .limit(1);
    if (!role) throw new Error('Owner role is missing; synchronize permissions first');
    await this.database
      .insert(accessUserRoles)
      .values({ userId, roleId: role.id })
      .onConflictDoNothing();
  }

  async permissionsForUser(userId: string): Promise<string[]> {
    const records = await this.database
      .selectDistinct({ key: accessRolePermissions.permissionKey })
      .from(accessUserRoles)
      .innerJoin(accessRolePermissions, eq(accessRolePermissions.roleId, accessUserRoles.roleId))
      .where(eq(accessUserRoles.userId, userId));
    return records.map(({ key }) => key).sort();
  }
}
