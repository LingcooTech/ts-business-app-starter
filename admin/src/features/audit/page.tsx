import { apiErrorMessage, useAuditLogs } from '@ts-business-app-starter/api-client';
import { Alert, Badge, Card, DataTable, PageHeader, TextField } from '@ts-business-app-starter/ui';
import { useState, type FormEvent } from 'react';

export function AuditPage() {
  const [search, setSearch] = useState<string>();
  const logs = useAuditLogs({ page: 1, pageSize: 50, ...(search ? { search } : {}) });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('search') ?? '').trim();
    setSearch(value || undefined);
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Audit trail"
        title="审计日志"
        description="只记录关键业务动作；日志为追加式存储，数据库层禁止修改和删除。"
      />
      <Card className="audit-filter-card">
        <form onSubmit={submit}>
          <TextField
            name="search"
            label="搜索"
            defaultValue={search}
            placeholder="Action、Resource、Actor 或 Request ID"
          />
        </form>
      </Card>
      {logs.isError ? <Alert tone="danger">{apiErrorMessage(logs.error)}</Alert> : null}
      <Card className="table-card">
        <DataTable
          rows={logs.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'time',
              header: '时间',
              render: (row) => new Date(row.occurredAt).toLocaleString('zh-CN'),
            },
            {
              key: 'action',
              header: '动作',
              render: (row) => (
                <div className="audit-action">
                  <strong>{row.action}</strong>
                  <code>{row.requestId ?? '无 Request ID'}</code>
                </div>
              ),
            },
            {
              key: 'resource',
              header: '资源',
              render: (row) => `${row.resourceType}${row.resourceId ? ` · ${row.resourceId}` : ''}`,
            },
            {
              key: 'actor',
              header: 'Actor',
              render: (row) => `${row.actorType}${row.actorId ? ` · ${row.actorId}` : ''}`,
            },
            {
              key: 'outcome',
              header: '结果',
              align: 'end',
              render: (row) => (
                <Badge tone={row.outcome === 'success' ? 'success' : 'danger'}>
                  {row.outcome === 'success' ? '成功' : '失败'}
                </Badge>
              ),
            },
          ]}
          emptyMessage={logs.isPending ? '正在读取审计日志…' : '没有符合条件的审计事件'}
        />
      </Card>
      {logs.data ? (
        <p className="audit-summary">
          第 {logs.data.meta.page} 页，共 {logs.data.meta.total} 条事件
        </p>
      ) : null}
    </div>
  );
}
