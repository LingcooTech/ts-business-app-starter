import {
  apiErrorMessage,
  useConfirmPasswordReset,
  useRequestPasswordReset,
} from '@ts-business-app-starter/api-client';
import { Alert, Button, TextField } from '@ts-business-app-starter/ui';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AuthCard } from './auth-card';

export function ForgotPasswordPage() {
  const request = useRequestPasswordReset();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await request.mutateAsync(String(form.get('email')));
      setSent(true);
    } catch (cause) {
      setError(apiErrorMessage(cause));
    }
  }
  return (
    <AuthCard
      eyebrow="RECOVERY"
      title="找回密码"
      description="无论账户是否存在，接口都返回一致结果，避免泄露用户信息。"
    >
      {sent ? (
        <Alert tone="success" title="请求已受理">
          如果该邮箱存在，将收到密码重置指引。
        </Alert>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <TextField name="email" label="账户邮箱" type="email" required autoComplete="email" />
          <Button loading={request.isPending}>发送重置指引</Button>
        </form>
      )}
      <div className="auth-card__links">
        <Link to="/login">返回登录</Link>
      </div>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [search] = useSearchParams();
  const token = search.get('token') ?? '';
  const confirm = useConfirmPasswordReset();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword'));
    if (newPassword !== String(form.get('confirmPassword'))) {
      setError('两次输入的密码不一致。');
      return;
    }
    try {
      await confirm.mutateAsync({ token, newPassword });
      setDone(true);
    } catch (cause) {
      setError(apiErrorMessage(cause));
    }
  }
  return (
    <AuthCard eyebrow="NEW PASSWORD" title="设置新密码" description="完成后所有旧会话都会失效。">
      {!token ? (
        <Alert tone="danger">重置链接缺少有效令牌。</Alert>
      ) : done ? (
        <Alert tone="success">密码已更新，现在可以重新登录。</Alert>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <TextField
            name="newPassword"
            label="新密码"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
          />
          <TextField
            name="confirmPassword"
            label="确认新密码"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
          />
          <Button loading={confirm.isPending}>更新密码</Button>
        </form>
      )}
      <div className="auth-card__links">
        <Link to="/login">返回登录</Link>
      </div>
    </AuthCard>
  );
}
