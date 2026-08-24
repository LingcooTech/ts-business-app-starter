import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '@lingcoo-tech/http';
import type {
  ClearSettingRequest,
  SaveSettingRequest,
  SettingSource,
  SettingView,
} from '@ts-business-app-starter/contracts';
import { z } from 'zod';

import { DATABASE, type Database } from '../../../common/database/database.port';
import { AuditService, type AuditContext } from '../../audit/public';
import type { ResolvedSetting, SettingDefinition } from '../domain/settings.types';
import { SettingsCipher } from '../infrastructure/settings-cipher';
import { SettingsRepository } from '../infrastructure/persistence/settings.repository';
import { SettingsRegistry } from './settings.registry';

type StoredSetting = NonNullable<Awaited<ReturnType<SettingsRepository['find']>>>;

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly config: ConfigService,
    private readonly registry: SettingsRegistry,
    private readonly cipher: SettingsCipher,
    private readonly repository: SettingsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<{ items: SettingView[] }> {
    const records = new Map(
      (await this.repository.findAll()).map((record) => [record.key, record]),
    );
    return {
      items: this.registry
        .list()
        .map((definition) => this.toView(definition, records.get(definition.key) ?? null)),
    };
  }

  async getValue<T = unknown>(key: string): Promise<T | undefined> {
    const definition = this.registry.get(key);
    const resolved = this.resolve(definition, await this.repository.find(key));
    return resolved.value as T | undefined;
  }

  async save(
    key: string,
    input: SaveSettingRequest,
    context: AuditContext & { actorId: string },
  ): Promise<SettingView> {
    const definition = this.registry.get(key);
    const value = this.validate(definition, input.value);
    const stored = definition.sensitive
      ? { value: null, ...this.cipher.encrypt(value) }
      : { value, encryptedValue: null, keyId: null };

    const record = await this.database.transaction(async (transaction) => {
      const updated = await this.repository.save(
        key,
        stored,
        context.actorId,
        input.expectedVersion,
        transaction,
      );
      if (!updated) this.versionConflict();
      await this.audit.record(
        {
          ...context,
          action: 'settings.updated',
          resourceType: 'setting',
          resourceId: key,
          metadata: { sensitive: Boolean(definition.sensitive), version: updated.version },
        },
        transaction,
      );
      return updated;
    });
    return this.toView(definition, record);
  }

  async clear(
    key: string,
    input: ClearSettingRequest,
    context: AuditContext & { actorId: string },
  ): Promise<SettingView> {
    const definition = this.registry.get(key);
    await this.database.transaction(async (transaction) => {
      const removed = await this.repository.clear(key, input.expectedVersion, transaction);
      if (!removed) {
        if (input.expectedVersion !== undefined) this.versionConflict();
        return;
      }
      await this.audit.record(
        {
          ...context,
          action: 'settings.cleared',
          resourceType: 'setting',
          resourceId: key,
          metadata: { sensitive: Boolean(definition.sensitive), previousVersion: removed.version },
        },
        transaction,
      );
    });
    return this.toView(definition, null);
  }

  async test(key: string, context: AuditContext & { actorId: string }) {
    const definition = this.registry.get(key);
    if (!definition.test) {
      throw new ApiError(422, 'SETTING_TEST_UNAVAILABLE', 'This setting has no connection test');
    }
    const resolved = this.resolve(definition, await this.repository.find(key));
    if (resolved.value === undefined) {
      throw new ApiError(409, 'SETTING_NOT_CONFIGURED', 'Setting is not configured');
    }
    const result = await definition.test(resolved.value);
    await this.audit.record({
      ...context,
      action: 'settings.connection_tested',
      resourceType: 'setting',
      resourceId: key,
      outcome: result.ok ? 'success' : 'failure',
      metadata: { sensitive: Boolean(definition.sensitive) },
    });
    return result;
  }

  async rotateSecrets(context: AuditContext & { actorId: string }): Promise<{ rotated: number }> {
    const currentKeyId = this.cipher.currentKeyId();
    const candidates = (await this.repository.encrypted()).filter(
      (record) => record.keyId !== currentKeyId,
    );
    if (!candidates.length) return { rotated: 0 };

    await this.database.transaction(async (transaction) => {
      for (const record of candidates) {
        if (!record.encryptedValue || !record.keyId) {
          throw new Error(`Sensitive setting storage invariant failed: ${record.key}`);
        }
        const value = this.cipher.decrypt(record.encryptedValue, record.keyId);
        const definition = this.registry.get(record.key);
        this.validate(definition, value);
        const encrypted = this.cipher.encrypt(value);
        const updated = await this.repository.replaceEncryption(
          record.key,
          encrypted.encryptedValue,
          encrypted.keyId,
          context.actorId,
          transaction,
        );
        if (!updated) throw new Error(`Failed to rotate sensitive setting: ${record.key}`);
        await this.audit.record(
          {
            ...context,
            action: 'settings.secret_rotated',
            resourceType: 'setting',
            resourceId: record.key,
            metadata: {
              previousKeyId: record.keyId,
              currentKeyId,
              version: updated.version,
            },
          },
          transaction,
        );
      }
    });
    return { rotated: candidates.length };
  }

  private resolve(definition: SettingDefinition, record: StoredSetting | null): ResolvedSetting {
    if (record) {
      const storedValue = definition.sensitive
        ? this.cipher.decrypt(record.encryptedValue, record.keyId ?? '')
        : record.value;
      return {
        definition,
        value: this.validate(definition, storedValue),
        source: 'database',
        version: record.version,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
      };
    }
    const fallback = this.fallback(definition);
    return {
      definition,
      value: fallback.value,
      source: fallback.source,
      version: null,
      updatedAt: null,
      updatedBy: null,
    };
  }

  private fallback(definition: SettingDefinition): { value?: unknown; source: SettingSource } {
    if (definition.environment) {
      const value = this.config.get<unknown>(definition.environment);
      if (value !== undefined && value !== null && value !== '') {
        return { value: this.validate(definition, value), source: 'environment' };
      }
    }
    if (definition.defaultValue !== undefined) {
      return { value: this.validate(definition, definition.defaultValue), source: 'default' };
    }
    return { source: 'unset' };
  }

  private toView(definition: SettingDefinition, record: StoredSetting | null): SettingView {
    const resolved = definition.sensitive
      ? this.sensitiveResolution(definition, record)
      : this.resolve(definition, record);
    const base = {
      key: definition.key,
      group: definition.group,
      label: definition.label,
      description: definition.description,
      testable: Boolean(definition.test),
      source: resolved.source,
      configured: resolved.source !== 'unset',
      version: resolved.version,
      updatedAt: resolved.updatedAt?.toISOString() ?? null,
      updatedBy: resolved.updatedBy,
    };
    if (definition.sensitive) {
      return resolved.source === 'unset'
        ? { ...base, sensitive: true }
        : { ...base, sensitive: true, maskedValue: '••••••••' };
    }
    return resolved.value === undefined
      ? { ...base, sensitive: false }
      : { ...base, sensitive: false, value: resolved.value };
  }

  private sensitiveResolution(
    definition: SettingDefinition,
    record: StoredSetting | null,
  ): ResolvedSetting {
    if (record) {
      return {
        definition,
        source: 'database',
        version: record.version,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
      };
    }
    const fallback = this.fallback(definition);
    return {
      definition,
      source: fallback.source,
      version: null,
      updatedAt: null,
      updatedBy: null,
    };
  }

  private validate<T>(definition: SettingDefinition<T>, value: unknown): T {
    const parsed = definition.schema.safeParse(value);
    if (!parsed.success) {
      throw new ApiError(
        400,
        'SETTING_VALUE_INVALID',
        'Setting value is invalid',
        z.treeifyError(parsed.error),
      );
    }
    return parsed.data;
  }

  private versionConflict(): never {
    throw new ApiError(409, 'SETTING_VERSION_CONFLICT', 'Setting changed since it was loaded');
  }
}
