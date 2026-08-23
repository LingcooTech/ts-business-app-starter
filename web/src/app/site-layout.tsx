import { useLogout, useSession } from '@ts-business-app-starter/api-client';
import { Button, Spinner, useToast } from '@ts-business-app-starter/ui';
import { Link, Outlet, useNavigate } from 'react-router-dom';

export function SiteLayout() {
  const session = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const { notify } = useToast();

  async function signOut() {
    await logout.mutateAsync();
    notify('已退出当前账户。', 'success');
    navigate('/', { replace: true });
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="site-brand" to="/">
          <span>TS</span>
          <strong>Business Starter</strong>
        </Link>
        <nav aria-label="站点导航">
          <Link to="/#capabilities">基础能力</Link>
          {session.data ? <Link to="/account">我的账户</Link> : null}
          <a href="/admin/">管理后台</a>
        </nav>
        <div className="site-header__actions">
          {session.isPending ? (
            <Spinner size="sm" label="正在恢复会话" />
          ) : session.data ? (
            <Button
              variant="secondary"
              size="sm"
              loading={logout.isPending}
              onClick={() => void signOut()}
            >
              退出
            </Button>
          ) : (
            <Link className="site-button" to="/login">
              登录
            </Link>
          )}
        </div>
      </header>
      <Outlet />
      <footer className="site-footer">
        <span>TS Business App Starter</span>
        <p>NestJS application APIs · Shared React foundation</p>
      </footer>
    </div>
  );
}
