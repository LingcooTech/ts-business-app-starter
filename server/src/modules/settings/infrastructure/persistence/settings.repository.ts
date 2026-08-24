import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { EncryptedEnvelope } from '@lingcoo-tech/crypto';

import {
  DATABASE,
  type Database,
  type DatabaseExecutor,
} from '../../../../common/database/database.port';
import { systemSettings } from './settings.schema';

type StoredValue = {
  value: unknown | null;
  encryptedValue: EncryptedEnvelope | null;
  keyId: string | null;
};

@Injectable()
export class SettingsRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  findAll() {
    return this.database.select().from(systemSettings);
  }

  async find(key: string) {
    const [record] = await this.database
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    return record ?? null;
  }

  encrypted() {
    return this.database
      .select()
      .from(systemSettings)
      .where(isNotNull(systemSettings.encryptedValue));
  }

  async save(
    key: string,
    stored: StoredValue,
    updatedBy: string,
    expectedVersion: number | undefined,
    executor: DatabaseExecutor,
  ) {
    if (expectedVersion !== undefined) {
      const [record] = await executor
        .update(systemSettings)
        .set({
          ...stored,
          updatedBy,
          updatedAt: new Date(),
          version: sql`${systemSettings.version} + 1`,
        })
        .where(and(eq(systemSettings.key, key), eq(systemSettings.version, expectedVersion)))
        .returning();
      return record ?? null;
    }

    const [record] = await executor
      .insert(systemSettings)
      .values({ key, ...stored, updatedBy })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          ...stored,
          updatedBy,
          updatedAt: new Date(),
          version: sql`${systemSettings.version} + 1`,
        },
      })
      .returning();
    return record ?? null;
  }

  async clear(key: string, expectedVersion: number | undefined, executor: DatabaseExecutor) {
    const condition =
      expectedVersion === undefined
        ? eq(systemSettings.key, key)
        : and(eq(systemSettings.key, key), eq(systemSettings.version, expectedVersion));
    const [record] = await executor.delete(systemSettings).where(condition).returning();
    return record ?? null;
  }

  async replaceEncryption(
    key: string,
    encryptedValue: EncryptedEnvelope,
    keyId: string,
    updatedBy: string,
    executor: DatabaseExecutor,
  ) {
    const [record] = await executor
      .update(systemSettings)
      .set({
        encryptedValue,
        keyId,
        updatedBy,
        updatedAt: new Date(),
        version: sql`${systemSettings.version} + 1`,
      })
      .where(eq(systemSettings.key, key))
      .returning();
    return record ?? null;
  }
}
