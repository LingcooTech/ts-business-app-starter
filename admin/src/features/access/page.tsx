import { apiErrorMessage, usePermissions } from '@ts-business-app-starter/api-client';
import { Alert, Badge, Card, DataTable, PageHeader } from '@ts-business-app-starter/ui';

const descriptions: Record<string, string> = {
  'accounts.read': '查看账户',
  'accounts.manage': '管理账户状态',
  'roles.read': '查看角色与授权',
  'roles.manage': '管理角色与授权',
  'settings.read': '查看系统设置',
  'settings.manage': '管理系统设置',
  'integrations.manage': '配置第三方服务',
  'audit.read': '查看审计事件',
  'jobs.read': '查看后台任务',
  'jobs.manage': '管理与重试后台任务',
  'notifications.manage': '管理通知投递',
  'payments.read': '查看支付与退款',
  'payments.manage': '创建、查询、关闭支付与发起退款',
};

export function AccessPage() {
  const permissions = usePermissions();
  const rows = (permissions.data?.permissions ?? []).map((key) => ({
    key,
    description: descriptions[key] ?? '应用定义权限',
  }));
  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Access control"
        title="权限中心"
        description="当前展示登录账户从服务端会话得到的有效权限；角色管理将在对应应用模块中实现。"
      />
      {permissions.isError ? (
        <Alert tone="danger">{apiErrorMessage(permissions.error)}</Alert>
      ) : null}
      <Card className="table-card">
        <DataTable
          rows={rows}
          rowKey={(row) => row.key}
          columns={[
            { key: 'permission', header: '权限键', render: (row) => <code>{row.key}</code> },
            { key: 'description', header: '用途', render: (row) => row.description },
            {
              key: 'state',
              header: '状态',
              align: 'end',
              render: () => <Badge tone="success">已授予</Badge>,
            },
          ]}
          emptyMessage={permissions.isPending ? '正在读取权限…' : '当前账户没有权限'}
        />
      </Card>
    </div>
  );
}
