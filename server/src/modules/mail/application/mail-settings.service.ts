import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSmtpMailer, type SmtpMailerConfig } from '@lingcoo-tech/mailer';
import { z } from 'zod';

import { SettingsRegistry, SettingsService } from '../../settings/public';

const booleanSettingSchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
]);

@Injectable()
export class MailSettingsService implements OnModuleInit {
  private readonly logger = new Logger(MailSettingsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly registry: SettingsRegistry,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      key: 'integrations.smtp-host',
      group: 'integrations',
      label: 'SMTP 主机',
      description: 'SMTP 服务地址；连接测试会向发件地址发送一封真实测试邮件。',
      schema: z.string().trim().min(1).max(255),
      environment: 'SMTP_HOST',
    });
    this.registry.register({
      key: 'integrations.smtp-port',
      group: 'integrations',
      label: 'SMTP 端口',
      description: 'SMTP 服务端口。',
      schema: z.coerce.number().int().min(1).max(65_535),
      environment: 'SMTP_PORT',
      defaultValue: 587,
    });
    this.registry.register({
      key: 'integrations.smtp-secure',
      group: 'integrations',
      label: 'SMTP TLS',
      description: '是否在连接建立时直接启用 TLS。',
      schema: booleanSettingSchema,
      environment: 'SMTP_SECURE',
      defaultValue: false,
    });
    this.registry.register({
      key: 'integrations.smtp-user',
      group: 'integrations',
      label: 'SMTP 用户名',
      description: 'SMTP 身份验证用户名。',
      schema: z.string().trim().min(1).max(320),
      environment: 'SMTP_USER',
    });
    this.registry.register({
      key: 'integrations.smtp-from',
      group: 'integrations',
      label: 'SMTP 发件地址',
      description: '事务邮件的发件地址，也是连接测试的收件地址。',
      schema: z.string().trim().toLowerCase().pipe(z.email().max(320)),
      environment: 'SMTP_FROM',
    });
    this.registry.attachTest('integrations.smtp-host', async () => this.testConnection());
  }

  transport(): 'log' | 'smtp' {
    return this.config.getOrThrow<'log' | 'smtp'>('MAIL_TRANSPORT');
  }

  async smtpConfig(): Promise<SmtpMailerConfig> {
    const [host, port, secure, user, password, from] = await Promise.all([
      this.settings.getValue<string>('integrations.smtp-host'),
      this.settings.getValue<number>('integrations.smtp-port'),
      this.settings.getValue<boolean>('integrations.smtp-secure'),
      this.settings.getValue<string>('integrations.smtp-user'),
      this.settings.getValue<string>('integrations.smtp-password'),
      this.settings.getValue<string>('integrations.smtp-from'),
    ]);
    if (!host || !port || secure === undefined || !user || !password || !from) {
      throw new Error(
        'SMTP host, port, TLS mode, user, password, and from address must be configured',
      );
    }
    return { host, port, secure, user, password, from };
  }

  private async testConnection() {
    try {
      const smtp = await this.smtpConfig();
      await createSmtpMailer(smtp).send({
        to: smtp.from,
        subject: 'SMTP connection test',
        text: 'SMTP connection and authentication succeeded.',
      });
      return { ok: true, message: `SMTP test email sent to ${smtp.from}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SMTP connection test failed: ${message}`);
      return { ok: false, message: `SMTP connection failed: ${message}` };
    }
  }
}
