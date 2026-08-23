import { usePermissions, useSession } from '@ts-business-app-starter/api-client';
import { Badge, Card, PageHeader } from '@ts-business-app-starter/ui';

export function DashboardPage() {
  const session = useSession();
  const permissions = usePermissions(Boolean(session.data));
  const foundations = [
    { title: '身份与会话', status: '可用', detail: '登录、恢复、退出、CSRF 与密码管理' },
    {
      title: '访问控制',
      status: '可用',
      detail: `${permissions.data?.permissions.length ?? 0} 项当前账户权限`,
    },
    { title: '系统设置', status: '待开发', detail: '加密配置与环境变量兜底' },
    { title: '外部服务', status: '待开发', detail: '邮件、存储与支付 Provider' },
  ];
  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Overview"
        title="工作台"
        description="这是业务模块的统一可视化入口；已完成能力展示真实状态，尚未完成的能力明确标记。"
      />
      <section className="metric-grid">
        <Card>
          <span>当前会话</span>
          <strong>有效</strong>
          <small>
            到期 {new Date(session.data?.session.expiresAt ?? '').toLocaleDateString('zh-CN')}
          </small>
        </Card>
        <Card>
          <span>已授予权限</span>
          <strong>{permissions.data?.permissions.length ?? '—'}</strong>
          <small>权限键驱动菜单与页面</small>
        </Card>
        <Card>
          <span>账户状态</span>
          <strong>{session.data?.user.status === 'active' ? '正常' : '已停用'}</strong>
          <small>{session.data?.user.emailVerifiedAt ? '邮箱已验证' : '邮箱待验证'}</small>
        </Card>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <h2>通用应用能力</h2>
            <p>后续阶段将在这里逐项接入真实管理页面。</p>
          </div>
        </div>
        <div className="foundation-grid">
          {foundations.map((item) => (
            <Card key={item.title} className="foundation-card">
              <Badge tone={item.status === '可用' ? 'success' : 'neutral'}>{item.status}</Badge>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
