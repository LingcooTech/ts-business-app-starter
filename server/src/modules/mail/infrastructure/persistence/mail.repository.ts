import { Inject, Injectable } from '@nestjs/common';
import type { MailDeliveryQuery, MailTemplate } from '@ts-business-app-starter/contracts';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DatabaseExecutor,
} from '../../../../common/database/database.port';
import type { MailContent } from '../../domain/mail.types';
import { mailDeliveries } from './mail.schema';

@Injectable()
export class MailRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(
    content: MailContent,
    template: MailTemplate,
    idempotencyKey: string | undefined,
    executor: DatabaseExecutor,
  ) {
    const [delivery] = await executor
      .insert(mailDeliveries)
      .values({
        recipient: content.to,
        template,
        subject: content.subject,
        textBody: content.text,
        htmlBody: content.html,
        idempotencyKey,
      })
      .onConflictDoNothing()
      .returning();
    if (delivery) return delivery;
    if (!idempotencyKey) throw new Error('Failed to create mail delivery');
    const [existing] = await executor
      .select()
      .from(mailDeliveries)
      .where(eq(mailDeliveries.idempotencyKey, idempotencyKey))
      .limit(1);
    if (!existing) throw new Error('Failed to resolve idempotent mail delivery');
    return existing;
  }

  async attachJob(id: string, jobId: string, executor: DatabaseExecutor) {
    const [delivery] = await executor
      .update(mailDeliveries)
      .set({ jobId, updatedAt: new Date() })
      .where(eq(mailDeliveries.id, id))
      .returning();
    if (!delivery) throw new Error('Failed to attach mail job');
    return delivery;
  }

  async findById(id: string) {
    const [delivery] = await this.database
      .select()
      .from(mailDeliveries)
      .where(eq(mailDeliveries.id, id))
      .limit(1);
    return delivery ?? null;
  }

  async sent(id: string, simulated: boolean) {
    const [delivery] = await this.database
      .update(mailDeliveries)
      .set({
        status: 'sent',
        simulated: String(simulated),
        sentAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(mailDeliveries.id, id))
      .returning();
    return delivery ?? null;
  }

  async failed(id: string, error: string) {
    const [delivery] = await this.database
      .update(mailDeliveries)
      .set({ status: 'failed', lastError: error, updatedAt: new Date() })
      .where(eq(mailDeliveries.id, id))
      .returning();
    return delivery ?? null;
  }

  async search(query: MailDeliveryQuery) {
    const filters: SQL[] = [];
    if (query.status) filters.push(eq(mailDeliveries.status, query.status));
    if (query.search) {
      const pattern = `%${query.search}%`;
      const search = or(
        ilike(mailDeliveries.id, pattern),
        ilike(mailDeliveries.recipient, pattern),
        ilike(mailDeliveries.subject, pattern),
      );
      if (search) filters.push(search);
    }
    const where = filters.length ? and(...filters) : undefined;
    const offset = (query.page - 1) * query.pageSize;
    const [items, totals] = await Promise.all([
      this.database
        .select()
        .from(mailDeliveries)
        .where(where)
        .orderBy(desc(mailDeliveries.createdAt))
        .limit(query.pageSize)
        .offset(offset),
      this.database.select({ value: count() }).from(mailDeliveries).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }
}
