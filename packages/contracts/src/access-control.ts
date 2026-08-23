import { z } from 'zod';

export const permissionKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/)
  .max(120);

export const currentPermissionsSchema = z.object({
  permissions: z.array(permissionKeySchema),
});

export type PermissionKey = z.infer<typeof permissionKeySchema>;
export type CurrentPermissions = z.infer<typeof currentPermissionsSchema>;
