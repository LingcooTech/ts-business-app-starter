import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest, RequestPrincipal } from './auth-context';

export const PUBLIC_ROUTE = 'auth:public';
export const AUTHENTICATED_ROUTE = 'auth:authenticated';
export const REQUIRED_PERMISSIONS = 'auth:required-permissions';

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Authenticated = () => SetMetadata(AUTHENTICATED_ROUTE, true);
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) throw new Error('Authenticated principal is missing');
    return request.principal;
  },
);
