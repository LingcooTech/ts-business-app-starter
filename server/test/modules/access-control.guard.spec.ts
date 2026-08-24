import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { REQUIRED_PERMISSIONS } from '../../src/common/auth/auth.decorators';
import { AccessControlGuard } from '../../src/modules/access-control/api/access-control.guard';
import type { AccessControlService } from '../../src/modules/access-control/application/access-control.service';
import type { IdentityService } from '../../src/modules/identity/public';

const session = {
  sessionId: 'session-id',
  csrfDigest: 'digest',
  expiresAt: new Date('2026-08-30T00:00:00Z'),
  user: {
    id: 'fdda765f-fc57-5604-a269-52a7df8164ec',
    email: 'owner@example.com',
    displayName: null,
    status: 'active' as const,
    emailVerifiedAt: new Date('2026-08-23T00:00:00Z'),
    createdAt: new Date('2026-08-23T00:00:00Z'),
  },
};

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardFor(input: { method?: string; required?: string[]; permissions?: string[] }) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) =>
      key === REQUIRED_PERMISSIONS ? input.required : false,
    ),
  };
  const config = {
    getOrThrow: vi.fn((key: string) => (key === 'AUTH_COOKIE_NAME' ? 'session' : 'csrf')),
  };
  const identity = { resolveSession: vi.fn().mockResolvedValue(session) };
  const access = {
    permissionsForUser: vi.fn().mockResolvedValue(new Set(input.permissions ?? [])),
  };
  const request = {
    method: input.method ?? 'GET',
    cookies: { session: 'session-token', csrf: 'csrf-token' },
    headers: { 'x-csrf-token': 'csrf-token' },
  };
  const guard = new AccessControlGuard(
    reflector as unknown as Reflector,
    config as unknown as ConfigService,
    identity as unknown as IdentityService,
    access as unknown as AccessControlService,
  );
  return { guard, request, identity };
}

describe('AccessControlGuard', () => {
  it('authenticates sessions and attaches a permission-aware principal', async () => {
    const { guard, request } = guardFor({
      required: ['accounts.read'],
      permissions: ['accounts.read'],
    });
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toHaveProperty('principal.permissions', new Set(['accounts.read']));
  });

  it('rejects unsafe cookie-authenticated requests without the matching CSRF header', async () => {
    const { guard, request } = guardFor({ method: 'POST' });
    request.headers['x-csrf-token'] = 'wrong-token';
    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      statusCode: 403,
      code: 'CSRF_INVALID',
    });
  });

  it('rejects requests that lack a required permission', async () => {
    const { guard, request } = guardFor({ required: ['roles.manage'] });
    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_DENIED',
    });
  });

  it('rejects requests with no session cookies', async () => {
    const { guard, request, identity } = guardFor({});
    request.cookies = {} as typeof request.cookies;
    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(identity.resolveSession).not.toHaveBeenCalled();
  });
});
