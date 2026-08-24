import { Inject, Injectable } from '@nestjs/common';
import type { AuditQuery } from '@ts-business-app-starter/contracts';
import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DatabaseExecutor,
} from '../../../../common/database/database.port';
import type { AuditEvent } from '../../domain/audit.types';
import { auditLogs } from './audit.schema';

@Injectable()
export class AuditRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async append(event: AuditEvent, executor: DatabaseExecutor = this.database) {
    const [record] = await executor
      .insert(auditLogs)
      .values({
        actorType: event.actorType,
        actorId: event.actorId ?? null,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId ?? null,
        outcome: event.outcome ?? 'success',
        requestId: event.requestId ?? null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        metadata: event.metadata ?? {},
      })
      .returning();
    if (!record) throw new Error('Failed to append audit log');
    return record;
  }

  async findById(id: string) {
    const [record] = await this.database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
      .limit(1);
    return record ?? null;
  }

  async search(query: AuditQuery) {
    const filters: SQL[] = [];
    if (query.actorType) filters.push(eq(auditLogs.actorType, query.actorType));
    if (query.action) filters.push(eq(auditLogs.action, query.action));
    if (query.resourceType) filters.push(eq(auditLogs.resourceType, query.resourceType));
    if (query.outcome) filters.push(eq(auditLogs.outcome, query.outcome));
    if (query.from) filters.push(gte(auditLogs.occurredAt, new Date(query.from)));
    if (query.to) filters.push(lte(auditLogs.occurredAt, new Date(query.to)));
    if (query.search) {
      const pattern = `%${query.search}%`;
      const search = or(
        ilike(auditLogs.action, pattern),
        ilike(auditLogs.resourceType, pattern),
        ilike(auditLogs.resourceId, pattern),
        ilike(auditLogs.actorId, pattern),
        ilike(auditLogs.requestId, pattern),
      );
      if (search) filters.push(search);
    }
    const where = filters.length ? and(...filters) : undefined;
    const offset = (query.page - 1) * query.pageSize;
    const [items, totals] = await Promise.all([
      this.database
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.occurredAt), desc(auditLogs.id))
        .limit(query.pageSize)
        .offset(offset),
      this.database.select({ value: count() }).from(auditLogs).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }
}
