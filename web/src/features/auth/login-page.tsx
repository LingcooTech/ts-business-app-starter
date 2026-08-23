import { apiErrorMessage, useLogin, useSession } from '@ts-business-app-starter/api-client';
import { Alert, Button, TextField, useToast } from '@ts-business-app-starter/ui';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { AuthCard } from './auth-card';

export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const [error, setError] = useState<string>();
  if (session.data) return <Navigate to="/account" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await login.mutateAsync({
        email: String(form.get('email')),
        password: String(form.get('password')),
      });
      notify('登录成功。', 'success');
      navigate((location.state as { from?: string } | null)?.from ?? '/account', { replace: true });
    } catch (cause) {
      setError(apiErrorMessage(cause));
    }
  }

  return (
    <AuthCard
      eyebrow="WELCOME BACK"
      title="登录账户"
      description="登录后可查看会话状态并管理账户安全。"
    >
      <form onSubmit={(event) => void submit(event)}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <TextField
          name="email"
          label="邮箱"
          type="email"
          required
          autoComplete="email"
          placeholder="owner@example.com"
        />
        <TextField
          name="password"
          label="密码"
          type="password"
          required
          autoComplete="current-password"
        />
        <Button loading={login.isPending}>登录</Button>
      </form>
      <div className="auth-card__links">
        <Link to="/forgot-password">忘记密码？</Link>
        <a href="/admin/">管理后台登录</a>
      </div>
    </AuthCard>
  );
}
