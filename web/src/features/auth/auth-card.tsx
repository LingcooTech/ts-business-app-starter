import { Card } from '@ts-business-app-starter/ui';
import type { ReactNode } from 'react';

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <div className="auth-page__aside">
        <span>ACCOUNT FOUNDATION</span>
        <h1>同一套身份能力，服务所有终端。</h1>
        <p>Cookie 会话、CSRF 与契约校验由应用基础层统一处理。</p>
      </div>
      <Card className="auth-card">
        <span className="auth-card__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </Card>
    </main>
  );
}
