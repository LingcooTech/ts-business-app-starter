import type { MailContent } from './mail.types';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}

function actionMail(
  to: string,
  subject: string,
  intro: string,
  action: string,
  url: string,
): MailContent {
  const safeUrl = escapeHtml(url);
  return {
    to,
    subject,
    text: `${intro}\n\n${action}: ${url}`,
    html: `<p>${escapeHtml(intro)}</p><p><a href="${safeUrl}">${escapeHtml(action)}</a></p>`,
  };
}

export function emailVerificationMail(to: string, url: string): MailContent {
  return actionMail(
    to,
    'Verify your email',
    'Please verify your email address.',
    'Verify email',
    url,
  );
}

export function passwordResetMail(to: string, url: string): MailContent {
  return actionMail(
    to,
    'Reset your password',
    'A password reset was requested for your account.',
    'Reset password',
    url,
  );
}

export function adminInviteMail(to: string, url: string): MailContent {
  return actionMail(
    to,
    'You have been invited',
    'An administrator invited you to the application.',
    'Accept invitation',
    url,
  );
}

export function testMail(to: string, applicationName: string): MailContent {
  return {
    to,
    subject: `${applicationName} mail delivery test`,
    text: `This is a queued mail delivery test from ${applicationName}.`,
    html: `<p>This is a queued mail delivery test from <strong>${escapeHtml(applicationName)}</strong>.</p>`,
  };
}
