export const SYSTEM_PERMISSIONS = [
  { key: 'accounts.read', description: 'View accounts' },
  { key: 'accounts.manage', description: 'Create, update, disable, and restore accounts' },
  { key: 'roles.read', description: 'View roles and permission assignments' },
  { key: 'roles.manage', description: 'Manage roles and permission assignments' },
  { key: 'settings.read', description: 'View application settings' },
  { key: 'settings.manage', description: 'Manage application settings' },
  { key: 'integrations.manage', description: 'Configure external providers' },
  { key: 'audit.read', description: 'View audit events' },
  { key: 'jobs.read', description: 'View background jobs' },
  { key: 'jobs.manage', description: 'Retry and manage background jobs' },
  { key: 'payments.read', description: 'View provider-level payment records' },
  { key: 'payments.manage', description: 'Manage provider-level payment operations' },
  { key: 'notifications.manage', description: 'Manage notification delivery' },
  { key: 'storage.read', description: 'View stored objects and access URLs' },
  { key: 'storage.manage', description: 'Upload and delete stored objects' },
] as const;

export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[number]['key'];
export const OWNER_ROLE_KEY = 'system.owner';
