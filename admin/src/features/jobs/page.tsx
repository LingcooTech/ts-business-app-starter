import {
  apiErrorMessage,
  useJobs,
  useOutbox,
  usePermissions,
  useRetryJob,
  useRetryOutboxEvent,
} from '@ts-business-app-starter/api-client';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  PageHeader,
  useToast,
} from '@ts-business-app-starter/ui';

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'succeeded' || status === 'published') return 'success';
  if (status === 'dead') return 'danger';
  if (status === 'running' || status === 'processing') return 'warning';
  return 'neutral';
}

export function JobsPage() {
  const jobs = useJobs({ page: 1, pageSize: 50 });
  const outbox = useOutbox({ page: 1, pageSize: 50 });
  const permissions = usePermissions();
  const retryJob = useRetryJob();
  const retryEvent = useRetryOutboxEvent();
  const { notify } = useToast();
  const canManage = permissions.data?.permissions.includes('jobs.manage') ?? false;

  async function retry(kind: 'job' | 'event', id: string) {
    try {
      if (kind === 'job') await retryJob.mutateAsync(id);
      else await retryEvent.mutateAsync(id);
      notify('已重新放回待处理队列。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Background execution"
        title="任务与 Outbox"
        description="查看后台任务、重试历史和事务 Outbox 发布状态；死信可由管理员手工重新排队。"
      />
      {jobs.isError ? <Alert tone="danger">{apiErrorMessage(jobs.error)}</Alert> : null}
      <Card className="table-card">
        <h2>后台任务</h2>
        <DataTable
          rows={jobs.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            { key: 'type', header: '类型', render: (row) => <code>{row.type}</code> },
            {
              key: 'status',
              header: '状态',
              render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
            },
            {
              key: 'attempts',
              header: '尝试',
              render: (row) => `${row.attempts}/${row.maxAttempts}`,
            },
            {
              key: 'time',
              header: '计划时间',
              render: (row) => new Date(row.runAt).toLocaleString('zh-CN'),
            },
            {
              key: 'action',
              header: '操作',
              align: 'end',
              render: (row) =>
                canManage && row.status === 'dead' ? (
                  <Button size="sm" variant="ghost" onClick={() => void retry('job', row.id)}>
                    重试
                  </Button>
                ) : null,
            },
          ]}
          emptyMessage={jobs.isPending ? '正在读取任务…' : '暂无后台任务'}
        />
      </Card>
      {outbox.isError ? <Alert tone="danger">{apiErrorMessage(outbox.error)}</Alert> : null}
      <Card className="table-card">
        <h2>事务 Outbox</h2>
        <DataTable
          rows={outbox.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            { key: 'topic', header: 'Topic', render: (row) => <code>{row.topic}</code> },
            {
              key: 'status',
              header: '状态',
              render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
            },
            {
              key: 'attempts',
              header: '尝试',
              render: (row) => `${row.attempts}/${row.maxAttempts}`,
            },
            {
              key: 'time',
              header: '创建时间',
              render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
            },
            {
              key: 'action',
              header: '操作',
              align: 'end',
              render: (row) =>
                canManage && row.status === 'dead' ? (
                  <Button size="sm" variant="ghost" onClick={() => void retry('event', row.id)}>
                    重试
                  </Button>
                ) : null,
            },
          ]}
          emptyMessage={outbox.isPending ? '正在读取 Outbox…' : '暂无 Outbox 事件'}
        />
      </Card>
    </div>
  );
}
