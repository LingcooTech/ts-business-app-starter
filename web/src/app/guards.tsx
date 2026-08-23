import { apiErrorMessage, useSession } from '@ts-business-app-starter/api-client';
import { Alert, Spinner } from '@ts-business-app-starter/ui';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function RequireSession() {
  const session = useSession();
  const location = useLocation();
  if (session.isPending)
    return (
      <main className="route-state">
        <Spinner label="正在恢复会话" />
      </main>
    );
  if (session.isError)
    return (
      <main className="route-state">
        <Alert tone="danger">{apiErrorMessage(session.error)}</Alert>
      </main>
    );
  if (!session.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
