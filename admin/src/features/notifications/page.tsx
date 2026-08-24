import {
  apiErrorMessage,
  useArchiveNotification,
  useCreateAnnouncement,
  useMarkNotificationRead,
  useNotifications,
  usePermissions,
  useSession,
  useUnreadNotificationCount,
} from '@ts-business-app-starter/api-client';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  PageHeader,
  TextField,
  useToast,
} from '@ts-business-app-starter/ui';
import type { FormEvent } from 'react';

export function NotificationsPage() {
  const session = useSession();
  const permissions = usePermissions();
  const notifications = useNotifications({ page: 1, pageSize: 50 });
  const unread = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const archive = useArchiveNotification();
  const announce = useCreateAnnouncement();
  const { notify } = useToast();
  const canManage = permissions.data?.permissions.includes('notifications.manage') ?? false;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await announce.mutateAsync({
        recipientUserId: String(data.get('recipientUserId')),
        category: 'announcement',
        level: 'info',
        title: String(data.get('title')),
        body: String(data.get('body')),
        dedupeKey: crypto.randomUUID(),
      });
      event.currentTarget.reset();
      notify('公告与 Outbox 事件已在同一事务中提交。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Notification center"
        title="通知中心"
        description={`当前未读 ${unread.data ?? 0} 条；公告由事务 Outbox 可靠发布并按 dedupe key 去重。`}
      />
      {canManage ? (
        <Card>
          <h2>发布单用户公告</h2>
          <form onSubmit={(event) => void submit(event)}>
            <TextField
              name="recipientUserId"
              label="接收用户 ID"
              defaultValue={session.data?.user.id}
              required
            />
            <TextField name="title" label="标题" required />
            <TextField name="body" label="正文" required />
            <Button loading={announce.isPending}>通过 Outbox 发布</Button>
          </form>
        </Card>
      ) : null}
      {notifications.isError ? (
        <Alert tone="danger">{apiErrorMessage(notifications.error)}</Alert>
      ) : null}
      <Card className="table-card">
        <DataTable
          rows={notifications.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'title',
              header: '通知',
              render: (row) => (
                <div>
                  <strong>{row.title}</strong>
                  <p>{row.body}</p>
                </div>
              ),
            },
            {
              key: 'level',
              header: '级别',
              render: (row) => (
                <Badge
                  tone={
                    row.level === 'error'
                      ? 'danger'
                      : row.level === 'warning'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {row.level}
                </Badge>
              ),
            },
            {
              key: 'time',
              header: '时间',
              render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
            },
            {
              key: 'action',
              header: '操作',
              align: 'end',
              render: (row) => (
                <div>
                  {!row.readAt ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void markRead.mutateAsync(row.id)}
                    >
                      标记已读
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void archive.mutateAsync(row.id)}
                  >
                    归档
                  </Button>
                </div>
              ),
            },
          ]}
          emptyMessage={notifications.isPending ? '正在读取通知…' : '暂无通知'}
        />
      </Card>
    </div>
  );
}
