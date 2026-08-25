import {
  apiErrorMessage,
  useClosePaymentIntent,
  useCreatePaymentIntent,
  useCreatePaymentRefund,
  useMockSucceedPaymentIntent,
  usePaymentIntents,
  usePaymentRefunds,
  usePermissions,
  useQueryPaymentIntent,
  useQueryPaymentRefund,
  type PaymentIntent,
  type PaymentIntentStatus,
  type PaymentProvider,
  type PaymentRefundStatus,
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
import { useState, type FormEvent } from 'react';

function paymentTone(status: PaymentIntentStatus) {
  if (status === 'succeeded' || status === 'refunded') return 'success' as const;
  if (status === 'created' || status === 'pending' || status === 'partially_refunded') {
    return 'warning' as const;
  }
  if (status === 'failed') return 'danger' as const;
  return 'neutral' as const;
}

function refundTone(status: PaymentRefundStatus) {
  if (status === 'succeeded') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  return 'warning' as const;
}

function money(amountMinor: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(
    amountMinor / 100,
  );
}

export function PaymentsPage() {
  const intents = usePaymentIntents({ page: 1, pageSize: 50 });
  const refunds = usePaymentRefunds({ page: 1, pageSize: 50 });
  const permissions = usePermissions();
  const create = useCreatePaymentIntent();
  const query = useQueryPaymentIntent();
  const close = useClosePaymentIntent();
  const mockSucceed = useMockSucceedPaymentIntent();
  const createRefund = useCreatePaymentRefund();
  const queryRefund = useQueryPaymentRefund();
  const { notify } = useToast();
  const [selected, setSelected] = useState<PaymentIntent | null>(null);
  const canManage = permissions.data?.permissions.includes('payments.manage') ?? false;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const intent = await create.mutateAsync({
        merchantOrderId: String(values.get('merchantOrderId')),
        subject: String(values.get('subject')),
        description: String(values.get('description') || '') || undefined,
        amountMinor: Number(values.get('amountMinor')),
        provider: String(values.get('provider')) as PaymentProvider,
        currency: 'CNY',
        expiresInSeconds: 1_800,
        metadata: {},
      });
      form.reset();
      setSelected(intent);
      notify('支付意图已创建，补偿与超时关闭任务已排队。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  async function run(action: 'query' | 'close' | 'succeed', intent: PaymentIntent) {
    try {
      const updated =
        action === 'query'
          ? await query.mutateAsync(intent.id)
          : action === 'close'
            ? await close.mutateAsync(intent.id)
            : await mockSucceed.mutateAsync(intent.id);
      setSelected(updated);
      notify('支付状态已更新。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  async function refund(intent: PaymentIntent) {
    const amount = window.prompt(
      `输入退款金额（分），当前可退 ${intent.amountMinor - intent.refundedAmountMinor} 分：`,
    );
    if (!amount) return;
    try {
      await createRefund.mutateAsync({
        paymentIntentId: intent.id,
        input: {
          merchantRefundId: `refund-${Date.now()}`,
          amountMinor: Number(amount),
          reason: '管理员发起退款',
        },
      });
      notify('退款请求已提交，补偿任务已排队。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Provider-neutral payments"
        title="支付与退款"
        description="统一管理 Mock、支付宝和微信支付；金额始终以整数分存储，回调验签后才更新状态。"
      />
      {canManage ? (
        <Card>
          <form onSubmit={(event) => void submit(event)}>
            <TextField name="merchantOrderId" label="商户订单号" required />
            <TextField name="subject" label="支付标题" required />
            <TextField name="description" label="描述" />
            <TextField name="amountMinor" label="金额（分）" type="number" min="1" required />
            <label>
              <span>支付供应商</span>
              <select name="provider" defaultValue="mock">
                <option value="mock">Mock（仅非生产环境）</option>
                <option value="alipay">支付宝</option>
                <option value="wechat">微信支付</option>
              </select>
            </label>
            <Button loading={create.isPending}>创建支付意图</Button>
          </form>
        </Card>
      ) : null}
      {selected ? (
        <Alert tone="info">
          当前选择：{selected.merchantOrderId} · {selected.provider} · {selected.status}
          {selected.checkoutUrl ? (
            <>
              {' · '}
              <a href={selected.checkoutUrl} target="_blank" rel="noreferrer">
                打开收银台
              </a>
            </>
          ) : null}
        </Alert>
      ) : null}
      {intents.isError ? <Alert tone="danger">{apiErrorMessage(intents.error)}</Alert> : null}
      <Card className="table-card">
        <h2>支付意图</h2>
        <DataTable
          rows={intents.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'order',
              header: '订单',
              render: (row) => (
                <button className="table-link" type="button" onClick={() => setSelected(row)}>
                  {row.merchantOrderId}
                </button>
              ),
            },
            { key: 'provider', header: '供应商', render: (row) => row.provider },
            { key: 'amount', header: '金额', render: (row) => money(row.amountMinor) },
            {
              key: 'status',
              header: '状态',
              render: (row) => <Badge tone={paymentTone(row.status)}>{row.status}</Badge>,
            },
            {
              key: 'action',
              header: '操作',
              align: 'end',
              render: (row) =>
                canManage ? (
                  <div className="table-actions">
                    <Button size="sm" variant="ghost" onClick={() => void run('query', row)}>
                      查询
                    </Button>
                    {row.provider === 'mock' && ['created', 'pending'].includes(row.status) ? (
                      <Button size="sm" variant="ghost" onClick={() => void run('succeed', row)}>
                        模拟成功
                      </Button>
                    ) : null}
                    {['created', 'pending'].includes(row.status) ? (
                      <Button size="sm" variant="ghost" onClick={() => void run('close', row)}>
                        关闭
                      </Button>
                    ) : null}
                    {['succeeded', 'partially_refunded'].includes(row.status) ? (
                      <Button size="sm" variant="ghost" onClick={() => void refund(row)}>
                        退款
                      </Button>
                    ) : null}
                  </div>
                ) : null,
            },
          ]}
          emptyMessage={intents.isPending ? '正在读取支付意图…' : '暂无支付意图'}
        />
      </Card>
      {refunds.isError ? <Alert tone="danger">{apiErrorMessage(refunds.error)}</Alert> : null}
      <Card className="table-card">
        <h2>退款记录</h2>
        <DataTable
          rows={refunds.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            { key: 'refund', header: '退款单号', render: (row) => row.merchantRefundId },
            { key: 'amount', header: '金额', render: (row) => money(row.amountMinor) },
            {
              key: 'status',
              header: '状态',
              render: (row) => <Badge tone={refundTone(row.status)}>{row.status}</Badge>,
            },
            {
              key: 'action',
              header: '操作',
              align: 'end',
              render: (row) =>
                canManage && row.status === 'pending' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void queryRefund.mutateAsync(row.id)}
                  >
                    查询
                  </Button>
                ) : null,
            },
          ]}
          emptyMessage={refunds.isPending ? '正在读取退款记录…' : '暂无退款记录'}
        />
      </Card>
    </div>
  );
}
