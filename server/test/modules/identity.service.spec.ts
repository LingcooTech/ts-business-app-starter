import { createHash } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { hashPassword } from '@lingcoo-tech/security/password';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdentityService } from '../../src/modules/identity/application/identity.service';
import type { IdentityRepository } from '../../src/modules/identity/infrastructure/persistence/identity.repository';

const user = {
  id: 'fdda765f-fc57-5604-a269-52a7df8164ec',
  email: 'owner@example.com',
  displayName: null,
  status: 'active' as const,
  emailVerifiedAt: new Date('2026-08-23T00:00:00Z'),
  createdAt: new Date('2026-08-23T00:00:00Z'),
};

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('IdentityService', () => {
  type RepositoryMethod =
    | 'findCredentialByEmail'
    | 'findCredentialByUserId'
    | 'findUserByEmail'
    | 'updatePasswordHash'
    | 'changePasswordAndRevokeSessions'
    | 'createSession'
    | 'resolveSession'
    | 'touchSession'
    | 'revokeSession'
    | 'createActionToken'
    | 'consumeEmailVerification'
    | 'resetPasswordWithToken'
    | 'createUser';
  let repository: Record<RepositoryMethod, ReturnType<typeof vi.fn>>;
  let service: IdentityService;

  beforeEach(() => {
    repository = {
      findCredentialByEmail: vi.fn(),
      findCredentialByUserId: vi.fn(),
      findUserByEmail: vi.fn(),
      updatePasswordHash: vi.fn(),
      changePasswordAndRevokeSessions: vi.fn(),
      createSession: vi.fn().mockResolvedValue({ id: 'session-id' }),
      resolveSession: vi.fn(),
      touchSession: vi.fn(),
      revokeSession: vi.fn(),
      createActionToken: vi.fn(),
      consumeEmailVerification: vi.fn(),
      resetPasswordWithToken: vi.fn(),
      createUser: vi.fn(),
    };
    const config = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'AUTH_SESSION_TTL_SECONDS') return 604_800;
        if (key === 'AUTH_ACTION_TOKEN_TTL_SECONDS') return 3600;
        if (key === 'AUTH_EXPOSE_TEST_TOKENS') return true;
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };
    service = new IdentityService(
      repository as unknown as IdentityRepository,
      config as unknown as ConfigService,
    );
  });

  it('creates a server-side session without persisting raw tokens', async () => {
    repository.findCredentialByEmail.mockResolvedValue({
      user,
      passwordHash: await hashPassword('correct horse battery staple'),
    });

    const result = await service.login(
      { email: user.email, password: 'correct horse battery staple' },
      'test-agent',
    );

    expect(result.sessionToken).toHaveLength(43);
    expect(result.csrfToken).toHaveLength(43);
    expect(repository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        tokenDigest: digest(result.sessionToken),
        csrfDigest: digest(result.csrfToken),
        userAgent: 'test-agent',
      }),
    );
    expect(JSON.stringify(repository.createSession.mock.calls)).not.toContain(result.sessionToken);
  });

  it('requires both the session token and its bound CSRF token', async () => {
    repository.resolveSession.mockResolvedValue({
      sessionId: 'session-id',
      csrfDigest: digest('correct-csrf-token'),
      expiresAt: new Date('2026-08-30T00:00:00Z'),
      user,
    });

    await expect(service.resolveSession('session-token', 'wrong-csrf-token')).resolves.toBeNull();
    await expect(
      service.resolveSession('session-token', 'correct-csrf-token'),
    ).resolves.toMatchObject({ sessionId: 'session-id' });
    expect(repository.touchSession).toHaveBeenCalledWith('session-id');
  });

  it('returns the same login error for missing users and invalid credentials', async () => {
    repository.findCredentialByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@example.com', password: 'incorrect' }, null),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });

    repository.findCredentialByEmail.mockResolvedValue({
      user,
      passwordHash: await hashPassword('correct horse battery staple'),
    });
    await expect(
      service.login({ email: user.email, password: 'incorrect' }, null),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('issues digested reset tokens and never reveals them when disabled', async () => {
    repository.findUserByEmail.mockResolvedValue(user);
    const result = await service.requestPasswordReset(user.email);
    expect(result.testToken).toHaveLength(43);
    expect(repository.createActionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        purpose: 'password_reset',
        tokenDigest: digest(result.testToken!),
      }),
    );
  });

  it('revokes every session after a password change', async () => {
    repository.findCredentialByUserId.mockResolvedValue({
      user,
      passwordHash: await hashPassword('correct horse battery staple'),
    });
    await service.changePassword(user.id, {
      currentPassword: 'correct horse battery staple',
      newPassword: 'a completely different strong password',
    });
    expect(repository.changePasswordAndRevokeSessions).toHaveBeenCalledWith(
      user.id,
      expect.stringMatching(/^scrypt:v1:/),
    );
  });
});
