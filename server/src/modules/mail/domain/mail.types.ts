import type { MailTemplate } from '@ts-business-app-starter/contracts';

export const MAIL_PORT = Symbol('MAIL_PORT');

export type MailContent = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailPort = {
  send(message: MailContent): Promise<{ simulated: boolean }>;
};

export type QueueMail = MailContent & {
  template: MailTemplate;
  idempotencyKey?: string;
};
