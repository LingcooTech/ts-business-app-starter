import {
  apiErrorMessage,
  useDeleteStorageObject,
  useStorageObjectAccess,
  useStorageObjects,
  useUploadStorageObject,
  type StorageObject,
  type StorageVisibility,
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

export function StoragePage() {
  const objects = useStorageObjects({ page: 1, pageSize: 50 });
  const upload = useUploadStorageObject();
  const access = useStorageObjectAccess();
  const remove = useDeleteStorageObject();
  const { notify } = useToast();
  const [selected, setSelected] = useState<StorageObject | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = values.get('file');
    if (!(file instanceof File) || file.size === 0) {
      notify('请选择要上传的文件。', 'danger');
      return;
    }
    try {
      const object = await upload.mutateAsync({
        file,
        input: {
          prefix: String(values.get('prefix') ?? 'media'),
          visibility: String(values.get('visibility') ?? 'private') as StorageVisibility,
        },
      });
      form.reset();
      setSelected(object);
      notify('文件上传并校验完成。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  async function open(object: StorageObject) {
    try {
      const result = await access.mutateAsync(object.id);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  async function deleteObject(object: StorageObject) {
    if (!window.confirm(`确认删除 ${object.originalName}？此操作会删除 Provider 中的对象。`))
      return;
    try {
      await remove.mutateAsync(object.id);
      if (selected?.id === object.id) setSelected(null);
      notify('对象已删除。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Provider-neutral object storage"
        title="媒体与对象存储"
        description="统一管理本地与 S3-compatible Provider；访问密钥只存在于加密设置或环境变量中。"
      />
      <Card>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span>文件</span>
            <input name="file" type="file" required />
          </label>
          <TextField name="prefix" label="路径前缀" defaultValue="media" required />
          <label>
            <span>访问策略</span>
            <select name="visibility" defaultValue="private">
              <option value="private">私有</option>
              <option value="public">公共</option>
            </select>
          </label>
          <Button loading={upload.isPending}>上传文件</Button>
        </form>
      </Card>
      {selected ? (
        <Alert tone="success">
          已选择：{selected.originalName} · 对象 ID：{selected.id}
        </Alert>
      ) : null}
      {objects.isError ? <Alert tone="danger">{apiErrorMessage(objects.error)}</Alert> : null}
      <Card className="table-card">
        <DataTable
          rows={objects.data?.items ?? []}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'name',
              header: '对象',
              render: (row) => (
                <button type="button" className="table-link" onClick={() => setSelected(row)}>
                  {row.originalName}
                </button>
              ),
            },
            { key: 'provider', header: 'Provider', render: (row) => row.provider },
            { key: 'type', header: '类型', render: (row) => row.contentType },
            {
              key: 'size',
              header: '大小',
              render: (row) => `${(row.sizeBytes / 1024).toFixed(1)} KB`,
            },
            {
              key: 'status',
              header: '状态',
              render: (row) => (
                <Badge
                  tone={
                    row.status === 'ready'
                      ? 'success'
                      : row.status === 'deleted'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {row.status} · {row.visibility}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '操作',
              render: (row) => (
                <div className="table-actions">
                  <Button disabled={row.status !== 'ready'} onClick={() => void open(row)}>
                    打开
                  </Button>
                  <Button disabled={row.status !== 'ready'} onClick={() => void deleteObject(row)}>
                    删除
                  </Button>
                </div>
              ),
            },
          ]}
          emptyMessage={objects.isPending ? '正在读取对象…' : '暂无存储对象'}
        />
      </Card>
    </div>
  );
}
