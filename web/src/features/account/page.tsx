import {
  apiErrorMessage,
  useChangePassword,
  useRequestEmailVerification,
  useSession,
} from '@ts-business-app-starter/api-client';
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
  const requestVerification = useRequestEmailVerification();
  const changePassword = useChangePassword();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [error, setError] = useState<string>();

  async function sendVerification() {
    try {
      await requestVerification.mutateAsync();
      notify('验证邮件请求已受理。', 'success');
    } catch (cause) {
      notify(apiErrorMessage(cause), 'danger');
    }
  }

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
    <main className="account-page">
      <PageHeader
        eyebrow="Account"
        title="账户中心"
        description="页面状态全部来自真实会话接口，不在浏览器中持久化敏感凭证。"
      />
      <div className="account-layout">
        <Card className="profile-card">
          <div className="profile-avatar">{session.data?.user.email.slice(0, 1).toUpperCase()}</div>
          <h2>{session.data?.user.displayName ?? '通用账户'}</h2>
          <p>{session.data?.user.email}</p>
          <Badge tone={session.data?.user.emailVerifiedAt ? 'success' : 'warning'}>
            {session.data?.user.emailVerifiedAt ? '邮箱已验证' : '邮箱待验证'}
          </Badge>
          <dl>
            <div>
              <dt>账户状态</dt>
              <dd>{session.data?.user.status === 'active' ? '正常' : '已停用'}</dd>
            </div>
            <div>
              <dt>会话到期</dt>
              <dd>{new Date(session.data?.session.expiresAt ?? '').toLocaleString('zh-CN')}</dd>
            </div>
          </dl>
          {!session.data?.user.emailVerifiedAt ? (
            <Button
              variant="secondary"
              loading={requestVerification.isPending}
              onClick={() => void sendVerification()}
            >
              发送验证邮件
            </Button>
          ) : null}
        </Card>
        <Card className="security-card">
          <span className="section-kicker">SECURITY</span>
          <h2>更新密码</h2>
          <p>修改密码将撤销此账户的所有有效会话。</p>
          <form onSubmit={(event) => void submit(event)}>
            {error ? <Alert tone="danger">{error}</Alert> : null}
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
              hint="至少 12 个字符"
            />
            <Button loading={changePassword.isPending}>更新密码</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
