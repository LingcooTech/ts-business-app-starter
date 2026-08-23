import { apiErrorMessage, useConfirmEmailVerification } from '@ts-business-app-starter/api-client';
import { Alert, Button } from '@ts-business-app-starter/ui';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AuthCard } from './auth-card';

export function VerifyEmailPage() {
  const [search] = useSearchParams();
  const token = search.get('token') ?? '';
  const confirm = useConfirmEmailVerification();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  async function verify() {
    setError(undefined);
    try {
      await confirm.mutateAsync(token);
      setDone(true);
    } catch (cause) {
      setError(apiErrorMessage(cause));
    }
  }
  return (
    <AuthCard eyebrow="VERIFY EMAIL" title="验证邮箱" description="确认此邮箱归属于当前账户。">
      {!token ? (
        <Alert tone="danger">验证链接缺少有效令牌。</Alert>
      ) : done ? (
        <Alert tone="success">邮箱验证已完成。</Alert>
      ) : (
        <>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button loading={confirm.isPending} onClick={() => void verify()}>
            确认验证
          </Button>
        </>
      )}
      <div className="auth-card__links">
        <Link to="/account">返回账户中心</Link>
      </div>
    </AuthCard>
  );
}
