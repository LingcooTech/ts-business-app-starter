import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="not-found">
      <span>404</span>
      <h1>没有找到这个页面</h1>
      <p>该地址尚未注册到 Web 应用。</p>
      <Link className="site-button" to="/">
        返回首页
      </Link>
    </main>
  );
}
