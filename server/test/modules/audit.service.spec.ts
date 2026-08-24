import { describe, expect, it, vi } from 'vitest';

import { AuditService } from '../../src/modules/audit/application/audit.service';
import { redactAuditMetadata } from '../../src/modules/audit/domain/redact-metadata';
import type { AuditRepository } from '../../src/modules/audit/infrastructure/persistence/audit.repository';

describe('audit metadata', () => {
  it('recursively redacts credentials without mutating useful resource metadata', () => {
    expect(
      redactAuditMetadata({
        settingKey: 'integrations.smtp-password',
        password: 'plain-password',
        nested: { accessToken: 'plain-token', status: 'configured' },
      }),
    ).toEqual({
      settingKey: 'integrations.smtp-password',
      password: '[REDACTED]',
      nested: { accessToken: '[REDACTED]', status: 'configured' },
    });
  });

  it('sanitizes metadata before the append-only repository sees it', async () => {
    const repository = { append: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
    const audit = new AuditService(repository as unknown as AuditRepository);
    await audit.record({
      actorType: 'system',
      action: 'test.executed',
      resourceType: 'test',
      metadata: { authorization: 'Bearer secret', safe: true },
    });
    expect(repository.append).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { authorization: '[REDACTED]', safe: true } }),
      undefined,
    );
  });
});
