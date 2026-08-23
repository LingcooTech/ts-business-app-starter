import { apiErrorMessage, useLogin, useSession } from '@ts-business-app-starter/api-client';
import { Alert, Badge, Button, Card, TextField, useToast } from '@ts-business-app-starter/ui';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [error, setError] = useState<string>();

  if (session.data) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await login.mutateAsync({
        email: String(form.get('email')),
        password: String(form.get('password')),
      });
      notify('欢迎回来，管理会话已建立。', 'success');
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (cause) {
      setError(apiErrorMessage(cause));
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login__brand">
        <Link className="brand-lockup brand-lockup--light" to="/login">
          <span>TS</span>
          <strong>Business</strong>
        </Link>
        <div>
          <Badge tone="brand">ADMIN FOUNDATION</Badge>
          <h1>把业务模块装进一个可靠的管理后台。</h1>
          <p>
            身份、权限、统一请求、错误处理与共享 UI
            已接通。后续模块完成即可获得可见、可操作的管理界面。
          </p>
        </div>
        <small>Framework-neutral UI · NestJS application APIs</small>
      </section>
      <section className="admin-login__form-wrap">
        <form className="admin-login__form" onSubmit={(event) => void submit(event)}>
          <div>
            <span className="section-kicker">管理后台</span>
            <h2>登录工作区</h2>
            <p>使用初始化管理员账户继续。</p>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <TextField
            name="email"
            label="邮箱"
            type="email"
            autoComplete="email"
            required
            placeholder="owner@example.com"
          />
          <TextField
            name="password"
            label="密码"
            type="password"
            autoComplete="current-password"
            required
            placeholder="输入账户密码"
          />
          <Button type="submit" loading={login.isPending}>
            登录
          </Button>
          <Link className="text-link" to="/forgot-password">
            忘记密码？
          </Link>
        </form>
      </section>
    </main>
  );
}

export function ForgotPasswordPage() {
  return (
    <main className="admin-centered-page">
      <Card className="admin-message-card">
        <Badge tone="brand">ACCOUNT RECOVERY</Badge>
        <h1>通过用户端重置密码</h1>
        <p>密码找回是通用账户能力，请前往 Web 端完成；管理后台不复制另一套流程。</p>
        <a className="ui-button ui-button--primary ui-button--md" href="/forgot-password">
          打开 Web 端
        </a>
        <Link className="text-link" to="/login">
          返回登录
        </Link>
      </Card>
    </main>
  );
}
