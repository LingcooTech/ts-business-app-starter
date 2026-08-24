import { Injectable, Logger } from '@nestjs/common';
import { createSmtpMailer } from '@lingcoo-tech/mailer';

import type { MailContent, MailPort } from '../domain/mail.types';
import { MailSettingsService } from '../application/mail-settings.service';

@Injectable()
export class ConfiguredMailAdapter implements MailPort {
  private readonly logger = new Logger(ConfiguredMailAdapter.name);

  constructor(private readonly settings: MailSettingsService) {}

  async send(message: MailContent): Promise<{ simulated: boolean }> {
    if (this.settings.transport() === 'log') {
      this.logger.log(`[simulated] ${message.subject} -> ${message.to}`);
      return { simulated: true };
    }
    const mailer = createSmtpMailer(await this.settings.smtpConfig());
    await mailer.send(message);
    return { simulated: false };
  }
}
