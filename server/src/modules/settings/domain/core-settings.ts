import { z } from 'zod';

import type { SettingDefinition } from './settings.types';

export const CORE_SETTINGS: SettingDefinition[] = [
  {
    key: 'application.name',
    group: 'application',
    label: '应用名称',
    description: '管理后台和系统通知中使用的应用名称。',
    schema: z.string().trim().min(1).max(120),
    environment: 'APP_NAME',
  },
  {
    key: 'application.support-email',
    group: 'application',
    label: '支持邮箱',
    description: '面向用户展示的支持邮箱；未设置时保持为空。',
    schema: z.string().trim().toLowerCase().pipe(z.email().max(320)),
    environment: 'SUPPORT_EMAIL',
  },
  {
    key: 'integrations.smtp-password',
    group: 'integrations',
    label: 'SMTP 密码',
    description: '供后续 MailModule 使用的 SMTP 凭据；保存后只显示脱敏状态。',
    schema: z.string().min(1).max(1000),
    sensitive: true,
    environment: 'SMTP_PASSWORD',
  },
];
