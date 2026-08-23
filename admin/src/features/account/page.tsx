import { apiErrorMessage } from '@ts-business-app-starter/api-client';
import { useChangePassword, useSession } from '@ts-business-app-starter/api-client';
import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  TextField,
  useToast,
} from '@ts-business-app-starter/ui';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export function AccountPage() {
  const session = useSession();
  const changePassword = useChangePassword();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const { notify } = useToast();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await changePassword.mutateAsync({
        currentPassword: String(form.get('currentPassword')),
        newPassword: String(form.get('newPassword')),
      });
      notify('密码已更新，请重新登录。', 'success');
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(apiErrorMessage(cause));
    }
  }
  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="My account"
        title="账户与安全"
        description="账户信息来自当前服务端会话。修改密码后会撤销已有登录。"
      />
      <div className="account-grid">
        <Card className="account-card">
          <span className="account-avatar">
            {session.data?.user.email.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h2>{session.data?.user.displayName ?? '未设置显示名称'}</h2>
            <p>{session.data?.user.email}</p>
          </div>
          <Badge tone={session.data?.user.emailVerifiedAt ? 'success' : 'warning'}>
            {session.data?.user.emailVerifiedAt ? '邮箱已验证' : '邮箱待验证'}
          </Badge>
        </Card>
        <Card className="account-form-card">
          <h2>修改密码</h2>
          <p>新密码至少 12 个字符。</p>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <form onSubmit={(event) => void submit(event)}>
            <TextField
              name="currentPassword"
              label="当前密码"
              type="password"
              required
              autoComplete="current-password"
            />
            <TextField
              name="newPassword"
              label="新密码"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
            <Button loading={changePassword.isPending}>更新并重新登录</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
