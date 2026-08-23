import { apiErrorMessage, usePermissions, useSession } from '@ts-business-app-starter/api-client';
import { Alert, Spinner } from '@ts-business-app-starter/ui';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function FullPageState({ children }: { children: ReactNode }) {
  return <main className="admin-full-state">{children}</main>;
}

export function RequireSession() {
  const session = useSession();
  const location = useLocation();
  if (session.isPending)
    return (
      <FullPageState>
        <Spinner label="正在恢复会话" />
      </FullPageState>
    );
  if (session.isError) {
    return (
      <FullPageState>
        <Alert tone="danger" title="无法连接服务端">
          {apiErrorMessage(session.error)}
        </Alert>
      </FullPageState>
    );
  }
  if (!session.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequirePermission({ permission }: { permission: string }) {
  const permissions = usePermissions();
  if (permissions.isPending)
    return (
      <FullPageState>
        <Spinner label="正在校验权限" />
      </FullPageState>
    );
  if (permissions.isError) {
    return (
      <Alert tone="danger" title="权限校验失败">
        {apiErrorMessage(permissions.error)}
      </Alert>
    );
  }
  if (!permissions.data.permissions.includes(permission)) return <Navigate to="/" replace />;
  return <Outlet />;
}
