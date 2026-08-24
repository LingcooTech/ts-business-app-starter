import {
  apiErrorMessage,
  useMailDeliveries,
  useSendTestMail,
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

export function MailPage() {
  const deliveries = useMailDeliveries({ page: 1, pageSize: 50 });
  const send = useSendTestMail();
  const { notify } = useToast();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const to = String(new FormData(event.currentTarget).get('to') ?? '');
    try {
      await send.mutateAsync(to);
      event.currentTarget.reset();
      notify('测试邮件已入队，HTTP 请求未等待 SMTP 投递。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Transactional mail"
        title="邮件投递"
        description="邮件通过公共 Mailer 包和后台任务异步投递；开发记录模式会明确标记为模拟发送。"
      />
      <Card>
        <form onSubmit={(event) => void submit(event)}>
          <TextField name="to" type="email" label="测试收件地址" required />
          <Button loading={send.isPending}>加入发送队列</Button>
        </form>
      </Card>
      {deliveries.isError ? <Alert tone="danger">{apiErrorMessage(deliveries.error)}</Alert> : null}
      <Card className="table-card">
        <DataTable
          rows={deliveries.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            { key: 'recipient', header: '收件人', render: (row) => row.recipient },
            { key: 'subject', header: '主题', render: (row) => row.subject },
            {
              key: 'status',
              header: '状态',
              render: (row) => (
                <Badge
                  tone={
                    row.status === 'sent'
                      ? 'success'
                      : row.status === 'failed'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {row.status}
                  {row.simulated ? ' · simulated' : ''}
                </Badge>
              ),
            },
            {
              key: 'time',
              header: '创建时间',
              render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
            },
          ]}
          emptyMessage={deliveries.isPending ? '正在读取投递记录…' : '暂无邮件投递'}
        />
      </Card>
    </div>
  );
}
