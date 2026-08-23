import { Badge, Card, PageHeader } from '@ts-business-app-starter/ui';

export function FoundationPage() {
  const capabilities = [
    ['Identity', '身份与会话', '已完成', '登录、身份恢复、密码与邮箱验证'],
    ['Access', '访问控制', '已完成', '权限键、守卫与 Owner 初始化'],
    ['Settings', '系统设置', '下一阶段', '公开设置、加密敏感配置'],
    ['Providers', '外部服务', '下一阶段', '邮件、对象存储、支付 SDK'],
    ['Operations', '运行保障', '下一阶段', '任务、审计、通知与管理面板'],
  ];
  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Foundation map"
        title="基础能力地图"
        description="只呈现通用应用层，不放入教育、零售等行业逻辑。"
      />
      <div className="timeline">
        {capabilities.map(([key, title, status, description], index) => (
          <div className="timeline__item" key={key}>
            <span>{index + 1}</span>
            <Card>
              <div>
                <small>{key}</small>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <Badge tone={status === '已完成' ? 'success' : 'warning'}>{status}</Badge>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
