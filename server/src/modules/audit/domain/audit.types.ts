import type { AuditActorType, AuditOutcome, AuditQuery } from '@ts-business-app-starter/contracts';

export type AuditContext = {
  actorType: AuditActorType;
  actorId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuditEvent = AuditContext & {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: AuditOutcome;
  metadata?: Record<string, unknown>;
};

export type AuditSearch = AuditQuery;
