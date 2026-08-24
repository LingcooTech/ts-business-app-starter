import { ConfigService } from '@nestjs/config';
import { decryptJson, encryptJson } from '@lingcoo-tech/crypto';
import { describe, expect, it, vi } from 'vitest';

import type { Database, DatabaseTransaction } from '../../src/common/database/database.port';
import type { AuditService } from '../../src/modules/audit/public';
import { SettingsRegistry } from '../../src/modules/settings/application/settings.registry';
import { SettingsService } from '../../src/modules/settings/application/settings.service';
import { SettingsCipher } from '../../src/modules/settings/infrastructure/settings-cipher';
import type { SettingsRepository } from '../../src/modules/settings/infrastructure/persistence/settings.repository';

const actor = {
  actorType: 'user' as const,
  actorId: 'fdda765f-fc57-5604-a269-52a7df8164ec',
  requestId: 'req-settings-1',
};

function harness(input?: { currentKeyId?: string; keys?: Record<string, string>; smtp?: string }) {
  const currentKeyId = input?.currentKeyId ?? 'v1';
  const keys = input?.keys ?? { v1: 'a'.repeat(32) };
  const config = new ConfigService({
    APP_NAME: 'Starter',
    SMTP_PASSWORD: input?.smtp,
    SETTINGS_ENCRYPTION_CURRENT_KEY_ID: currentKeyId,
    SETTINGS_ENCRYPTION_KEYS: keys,
  });
  const transaction = {} as DatabaseTransaction;
  const database = {
    transaction: vi.fn(async (operation: (executor: DatabaseTransaction) => Promise<unknown>) =>
      operation(transaction),
    ),
  } as unknown as Database;
  const repository = {
    findAll: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockResolvedValue(null),
    encrypted: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    clear: vi.fn(),
    replaceEncryption: vi.fn(),
  } as unknown as SettingsRepository;
  const audit = { record: vi.fn().mockResolvedValue({}) } as unknown as AuditService;
  const service = new SettingsService(
    database,
    config,
    new SettingsRegistry(),
    new SettingsCipher(config),
    repository,
    audit,
  );
  return { service, repository, audit, transaction, keys };
}

describe('SettingsService', () => {
  it('encrypts sensitive overrides, masks API output, and audits in the same transaction', async () => {
    const { service, repository, audit, transaction, keys } = harness();
    vi.mocked(repository.save).mockImplementation(async (key, stored, updatedBy) => ({
      key,
      ...stored,
      version: 1,
      updatedBy,
      createdAt: new Date('2026-08-24T10:00:00Z'),
      updatedAt: new Date('2026-08-24T10:00:00Z'),
    }));

    const result = await service.save(
      'integrations.smtp-password',
      { value: 'database-secret' },
      actor,
    );
    const stored = vi.mocked(repository.save).mock.calls[0]?.[1];

    expect(stored?.value).toBeNull();
    expect(JSON.stringify(stored?.encryptedValue)).not.toContain('database-secret');
    expect(decryptJson(stored?.encryptedValue, keys.v1!)).toBe('database-secret');
    expect(result).toMatchObject({ sensitive: true, maskedValue: '••••••••', source: 'database' });
    expect(result).not.toHaveProperty('value');
    expect(vi.mocked(repository.save).mock.calls[0]?.[4]).toBe(transaction);
    expect(vi.mocked(audit.record).mock.calls[0]?.[1]).toBe(transaction);
    expect(vi.mocked(audit.record).mock.calls[0]?.[0]).not.toHaveProperty('metadata.value');
  });

  it('never exposes a sensitive environment fallback', async () => {
    const { service } = harness({ smtp: 'environment-secret' });
    const response = await service.list();
    const smtp = response.items.find((item) => item.key === 'integrations.smtp-password');
    expect(smtp).toMatchObject({
      source: 'environment',
      configured: true,
      maskedValue: '••••••••',
    });
    expect(JSON.stringify(smtp)).not.toContain('environment-secret');
  });

  it('decrypts an old key and migrates the envelope to the current key', async () => {
    const keys = { v1: 'a'.repeat(32), v2: 'b'.repeat(32) };
    const { service, repository, audit, transaction } = harness({ currentKeyId: 'v2', keys });
    vi.mocked(repository.encrypted).mockResolvedValue([
      {
        key: 'integrations.smtp-password',
        value: null,
        encryptedValue: encryptJson('old-secret', keys.v1),
        keyId: 'v1',
        version: 3,
        updatedBy: actor.actorId,
        createdAt: new Date('2026-08-24T09:00:00Z'),
        updatedAt: new Date('2026-08-24T09:00:00Z'),
      },
    ]);
    vi.mocked(repository.replaceEncryption).mockImplementation(
      async (key, encryptedValue, keyId, updatedBy) => ({
        key,
        value: null,
        encryptedValue,
        keyId,
        version: 4,
        updatedBy,
        createdAt: new Date('2026-08-24T09:00:00Z'),
        updatedAt: new Date('2026-08-24T10:00:00Z'),
      }),
    );

    await expect(service.rotateSecrets(actor)).resolves.toEqual({ rotated: 1 });
    const replacement = vi.mocked(repository.replaceEncryption).mock.calls[0];
    expect(replacement?.[2]).toBe('v2');
    expect(decryptJson(replacement?.[1], keys.v2)).toBe('old-secret');
    expect(replacement?.[4]).toBe(transaction);
    expect(vi.mocked(audit.record).mock.calls[0]?.[0]).toMatchObject({
      action: 'settings.secret_rotated',
      metadata: { previousKeyId: 'v1', currentKeyId: 'v2', version: 4 },
    });
  });
});
