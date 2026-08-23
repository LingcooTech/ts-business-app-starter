import { Card } from '@ts-business-app-starter/ui';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="admin-page">
      <Card className="admin-message-card">
        <h1>页面不存在</h1>
        <p>该地址未注册到管理后台路由。</p>
        <Link className="text-link" to="/">
          返回工作台
        </Link>
      </Card>
    </div>
  );
}
