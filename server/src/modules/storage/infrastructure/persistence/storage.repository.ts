import { Inject, Injectable } from '@nestjs/common';
import type {
  StorageObjectQuery,
  StorageProvider,
  StorageVisibility,
} from '@ts-business-app-starter/contracts';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';

import { DATABASE, type Database } from '../../../../common/database/database.port';
import type { StorageWriteResult } from '../../domain/storage.types';
import { storageObjects } from './storage.schema';

@Injectable()
export class StorageRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(input: {
    provider: StorageProvider;
    bucket: string;
    key: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
    visibility: StorageVisibility;
    createdBy: string;
  }) {
    const [object] = await this.database.insert(storageObjects).values(input).returning();
    if (!object) throw new Error('Failed to create storage object');
    return object;
  }

  async findById(id: string) {
    const [object] = await this.database
      .select()
      .from(storageObjects)
      .where(eq(storageObjects.id, id))
      .limit(1);
    return object ?? null;
  }

  async markReady(id: string, result: StorageWriteResult) {
    const [object] = await this.database
      .update(storageObjects)
      .set({
        status: 'ready',
        sizeBytes: result.sizeBytes,
        contentType: result.contentType,
        etag: result.etag,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(storageObjects.id, id), eq(storageObjects.status, 'pending')))
      .returning();
    return object ?? null;
  }

  async markDeleted(id: string) {
    const [object] = await this.database
      .update(storageObjects)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(storageObjects.id, id), eq(storageObjects.status, 'ready')))
      .returning();
    return object ?? null;
  }

  async search(query: StorageObjectQuery) {
    const filters: SQL[] = [];
    if (query.provider) filters.push(eq(storageObjects.provider, query.provider));
    if (query.visibility) filters.push(eq(storageObjects.visibility, query.visibility));
    if (query.status) filters.push(eq(storageObjects.status, query.status));
    if (query.prefix) filters.push(ilike(storageObjects.key, `${query.prefix}/%`));
    if (query.search) {
      const pattern = `%${query.search}%`;
      const search = or(
        ilike(storageObjects.id, pattern),
        ilike(storageObjects.key, pattern),
        ilike(storageObjects.originalName, pattern),
        ilike(storageObjects.contentType, pattern),
      );
      if (search) filters.push(search);
    }
    const where = filters.length ? and(...filters) : undefined;
    const offset = (query.page - 1) * query.pageSize;
    const [items, totals] = await Promise.all([
      this.database
        .select()
        .from(storageObjects)
        .where(where)
        .orderBy(desc(storageObjects.createdAt), desc(storageObjects.id))
        .limit(query.pageSize)
        .offset(offset),
      this.database.select({ value: count() }).from(storageObjects).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }
}
