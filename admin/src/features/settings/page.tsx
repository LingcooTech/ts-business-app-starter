import {
  apiErrorMessage,
  useClearSetting,
  usePermissions,
  useRotateSettingSecrets,
  useSaveSetting,
  useSettings,
  useTestSetting,
} from '@ts-business-app-starter/api-client';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  TextField,
  useToast,
} from '@ts-business-app-starter/ui';
import type { FormEvent } from 'react';

const sourceLabels = {
  database: '数据库覆盖',
  environment: '环境变量',
  default: '默认值',
  unset: '未配置',
} as const;

export function SettingsPage() {
  const settings = useSettings();
  const permissions = usePermissions();
  const save = useSaveSetting();
  const clear = useClearSetting();
  const test = useTestSetting();
  const rotate = useRotateSettingSecrets();
  const { notify } = useToast();
  const canManage = permissions.data?.permissions.includes('settings.manage') ?? false;
  const pending = save.isPending || clear.isPending || test.isPending || rotate.isPending;

  async function submit(event: FormEvent<HTMLFormElement>, key: string, version: number | null) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('value') ?? '');
    try {
      await save.mutateAsync({
        key,
        input: { value, ...(version === null ? {} : { expectedVersion: version }) },
      });
      event.currentTarget.reset();
      notify('设置已保存并写入审计日志。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  async function clearOverride(key: string, version: number | null) {
    try {
      await clear.mutateAsync({
        key,
        input: version === null ? {} : { expectedVersion: version },
      });
      notify('数据库覆盖已清除，当前值回退到环境变量或默认值。', 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  async function testConnection(key: string) {
    try {
      const result = await test.mutateAsync(key);
      notify(result.message, result.ok ? 'success' : 'danger');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  async function rotateSecrets() {
    try {
      const result = await rotate.mutateAsync();
      notify(`密钥轮换完成，迁移 ${result.rotated} 项敏感设置。`, 'success');
    } catch (error) {
      notify(apiErrorMessage(error), 'danger');
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Settings"
        title="系统设置"
        description="数据库覆盖优先于环境变量；敏感值使用 AES-256-GCM 加密，界面永不回显明文。"
        actions={
          canManage ? (
            <Button
              variant="secondary"
              loading={rotate.isPending}
              onClick={() => void rotateSecrets()}
            >
              轮换敏感配置
            </Button>
          ) : undefined
        }
      />
      {settings.isError ? <Alert tone="danger">{apiErrorMessage(settings.error)}</Alert> : null}
      {!settings.isPending && !settings.data?.length ? (
        <Card>
          <EmptyState title="暂无设置定义" description="应用模块注册设置定义后会显示在这里。" />
        </Card>
      ) : null}
      <div className="settings-grid">
        {(settings.data ?? []).map((setting) => (
          <Card className="setting-card" key={setting.key}>
            <div className="setting-card__header">
              <div>
                <span className="section-kicker">{setting.group}</span>
                <h2>{setting.label}</h2>
              </div>
              <Badge tone={setting.configured ? 'success' : 'neutral'}>
                {sourceLabels[setting.source]}
              </Badge>
            </div>
            <p>{setting.description}</p>
            <code>{setting.key}</code>
            <div className="setting-card__current">
              <span>当前值</span>
              <strong>
                {setting.sensitive
                  ? (setting.maskedValue ?? '未配置')
                  : String(setting.value ?? '未配置')}
              </strong>
            </div>
            {canManage ? (
              <form
                key={`${setting.key}:${setting.version ?? setting.source}`}
                onSubmit={(event) => void submit(event, setting.key, setting.version)}
              >
                <TextField
                  name="value"
                  label={setting.sensitive ? '输入新秘密' : '数据库覆盖值'}
                  type={setting.sensitive ? 'password' : 'text'}
                  defaultValue={setting.sensitive ? '' : String(setting.value ?? '')}
                  placeholder={
                    setting.sensitive && setting.configured ? '输入新值以替换' : undefined
                  }
                  autoComplete="off"
                  required
                />
                <div className="setting-card__actions">
                  <Button loading={save.isPending}>保存</Button>
                  {setting.source === 'database' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => void clearOverride(setting.key, setting.version)}
                    >
                      清除覆盖
                    </Button>
                  ) : null}
                  {setting.testable ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => void testConnection(setting.key)}
                    >
                      测试连接
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
