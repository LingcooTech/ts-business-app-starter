import { timingSafeEqual } from 'node:crypto';

import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiError } from '@lingcoo-tech/http';

import type { AuthenticatedRequest } from '../../../common/auth/auth-context';
import { PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from '../../../common/auth/auth.decorators';
import { IdentityService } from '../../identity/public';
import { AccessControlService } from '../application/access-control.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function valuesMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

@Injectable()
export class AccessControlGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly identity: IdentityService,
    private readonly access: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = request.cookies[this.config.getOrThrow<string>('AUTH_COOKIE_NAME')];
    const csrfToken = request.cookies[this.config.getOrThrow<string>('AUTH_CSRF_COOKIE_NAME')];
    if (!sessionToken || !csrfToken) throw this.unauthenticated();

    const session = await this.identity.resolveSession(sessionToken, csrfToken);
    if (!session) throw this.unauthenticated();
    const permissions = await this.access.permissionsForUser(session.user.id);
    request.principal = {
      userId: session.user.id,
      sessionId: session.sessionId,
      email: session.user.email,
      user: session.user,
      csrfToken,
      expiresAt: session.expiresAt,
      permissions,
    };

    if (!SAFE_METHODS.has(request.method)) {
      const csrfHeader = request.headers['x-csrf-token'];
      const value = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
      if (!value || !valuesMatch(value, csrfToken)) {
        throw new ApiError(403, 'CSRF_INVALID', 'CSRF token is invalid');
      }
    }

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    const missing = required?.filter((permission) => !permissions.has(permission)) ?? [];
    if (missing.length > 0) {
      throw new ApiError(403, 'PERMISSION_DENIED', 'Required permission is missing', { missing });
    }
    return true;
  }

  private unauthenticated(): ApiError {
    return new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
  }
}
