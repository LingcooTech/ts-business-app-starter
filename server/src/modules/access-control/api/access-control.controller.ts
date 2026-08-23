import { Controller, Get } from '@nestjs/common';

import { Authenticated, CurrentPrincipal } from '../../../common/auth/auth.decorators';
import type { RequestPrincipal } from '../../../common/auth/auth-context';

@Controller('access')
export class AccessControlController {
  @Get('permissions')
  @Authenticated()
  permissions(@CurrentPrincipal() principal: RequestPrincipal) {
    return { permissions: [...principal.permissions].sort() };
  }
}
