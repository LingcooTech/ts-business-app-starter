import { useLogout, usePermissions, useSession } from '@ts-business-app-starter/api-client';
import { Button, useToast } from '@ts-business-app-starter/ui';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

const navigation = [
  { to: '/', label: '工作台', mark: '⌂' },
  { to: '/access', label: '权限中心', mark: '◇', permission: 'roles.read' },
  { to: '/settings', label: '系统设置', mark: '⚙', permission: 'settings.read' },
  { to: '/audit', label: '审计日志', mark: '≡', permission: 'audit.read' },
  { to: '/jobs', label: '后台任务', mark: '↻', permission: 'jobs.read' },
  { to: '/mail', label: '邮件投递', mark: '✉', permission: 'integrations.manage' },
  { to: '/notifications', label: '通知中心', mark: '●' },
  { to: '/foundation', label: '基础能力', mark: '▦' },
  { to: '/ui', label: 'UI 组件', mark: '◫' },
];

export function AdminLayout() {
  const session = useSession();
  const permissions = usePermissions(Boolean(session.data));
  const logout = useLogout();
  const navigate = useNavigate();
  const { notify } = useToast();
  const allowed = new Set(permissions.data?.permissions ?? []);

  async function signOut() {
    await logout.mutateAsync();
    notify('已安全退出。', 'success');
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand-lockup" to="/">
          <span>TS</span>
          <strong>Business</strong>
        </Link>
        <nav aria-label="主导航">
          {navigation
            .filter((item) => !item.permission || allowed.has(item.permission))
            .map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                <span aria-hidden="true">{item.mark}</span>
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="admin-sidebar__status">
          <span className="status-dot" />
          <div>
            <strong>应用底座</strong>
            <small>运行正常</small>
          </div>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span className="mobile-brand">TS Business</span>
          </div>
          <div className="admin-user">
            <span className="admin-user__avatar">
              {session.data?.user.email.slice(0, 1).toUpperCase()}
            </span>
            <Link to="/account">
              <strong>{session.data?.user.displayName ?? '管理员'}</strong>
              <small>{session.data?.user.email}</small>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              loading={logout.isPending}
              onClick={() => void signOut()}
            >
              退出
            </Button>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
