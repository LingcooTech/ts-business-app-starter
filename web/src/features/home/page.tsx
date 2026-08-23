import { useSession } from '@ts-business-app-starter/api-client';
import { Badge, Card } from '@ts-business-app-starter/ui';
import { Link } from 'react-router-dom';

export function HomePage() {
  const session = useSession();
  return (
    <main>
      <section className="hero">
        <div className="hero__glow" />
        <div className="hero__content">
          <Badge tone="brand">BUSINESS APPLICATION FOUNDATION</Badge>
          <h1>
            基础能力就位，
            <br />
            <em>业务从这里开始。</em>
          </h1>
          <p>
            围绕 NestJS 组织通用应用层，并为 Admin 与 Web 提供一致的会话、请求、交互和视觉基础。
          </p>
          <div className="hero__actions">
            <Link
              className="site-button site-button--large"
              to={session.data ? '/account' : '/login'}
            >
              {session.data ? '进入我的账户' : '体验登录流程'}
            </Link>
            <a className="site-button site-button--large site-button--secondary" href="/admin/">
              打开管理后台
            </a>
          </div>
          <div className="hero__proof">
            <span>
              <i />
              身份会话已接通
            </span>
            <span>
              <i />
              共享 UI 已建立
            </span>
            <span>
              <i />
              API 响应运行时校验
            </span>
          </div>
        </div>
        <Card className="hero-console" aria-label="应用基础状态">
          <div className="hero-console__top">
            <span />
            <span />
            <span />
            <small>foundation.status</small>
          </div>
          <div className="hero-console__body">
            <span className="console-label">APPLICATION LAYERS</span>
            {[
              ['NestJS API', 'ready'],
              ['Identity & access', 'ready'],
              ['Admin workspace', 'ready'],
              ['Web experience', 'ready'],
              ['Business modules', 'extend'],
            ].map(([name, status]) => (
              <div className="console-row" key={name}>
                <span>{name}</span>
                <Badge tone={status === 'ready' ? 'success' : 'brand'}>{status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <section className="capabilities" id="capabilities">
        <div className="capabilities__heading">
          <span>通用层边界</span>
          <h2>不包含行业逻辑，但不再从零开始。</h2>
          <p>底座负责每个业务应用都需要、并且容易重复造轮子的部分。</p>
        </div>
        <div className="capability-grid">
          {[
            ['01', '身份与安全', '服务端会话、CSRF、防暴力破解、密码与邮箱流程。'],
            ['02', 'Admin 工作区', '受保护路由、权限菜单、表格、表单、弹窗和反馈。'],
            ['03', 'Web 体验', '公共页面、身份恢复、账户中心与一致的错误边界。'],
            ['04', '类型安全请求', '契约校验、错误封装、缓存与请求状态集中处理。'],
            ['05', '外部服务', '邮件、对象存储与支付 Provider 将按相同模式接入。'],
            ['06', '工程交付', '生成器、迁移、测试、Docker 与 CI 保持可复制。'],
          ].map(([number, title, description]) => (
            <Card key={number} className="capability-card">
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
