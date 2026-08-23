export { AccessControlModule } from './access-control.module';
export { AccessControlService } from './application/access-control.service';
export { BootstrapService } from './application/bootstrap.service';
export {
  Authenticated,
  CurrentPrincipal,
  Public,
  RequirePermissions,
} from '../../common/auth/auth.decorators';
export type { RequestPrincipal } from '../../common/auth/auth-context';
export { SYSTEM_PERMISSIONS, OWNER_ROLE_KEY } from './domain/system-permissions';
export type { SystemPermission } from './domain/system-permissions';
