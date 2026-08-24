export { MailModule } from './mail.module';
export { MailService } from './application/mail.service';
export {
  adminInviteMail,
  emailVerificationMail,
  passwordResetMail,
  testMail,
} from './domain/mail-templates';
export type { MailContent, QueueMail } from './domain/mail.types';
