#!/usr/bin/env node

const [baseUrl, email, password] = process.argv.slice(2);
if (!baseUrl || !email || !password) {
  throw new Error('usage: verify-auth-smoke.mjs <base-url> <email> <password>');
}

async function json(response) {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.url}: ${JSON.stringify(body)}`);
  }
  return body;
}

const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'definitely-not-the-owner-password' }),
});
if (invalidLogin.status !== 401) throw new Error(`invalid login returned ${invalidLogin.status}`);

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'user-agent': 'business-starter-smoke' },
  body: JSON.stringify({ email, password }),
});
const identity = await json(login);
const setCookies = login.headers.getSetCookie();
const cookieHeader = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
if (!cookieHeader.includes('__Host-app_session='))
  throw new Error('HttpOnly session cookie is missing');
if (!cookieHeader.includes('__Host-app_csrf=')) throw new Error('CSRF cookie is missing');
if (!identity.csrfToken || identity.user.email !== email)
  throw new Error('login identity is invalid');

const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: cookieHeader } });
const recovered = await json(me);
if (recovered.user.id !== identity.user.id) throw new Error('identity recovery changed the user');

const permissionsResponse = await fetch(`${baseUrl}/api/access/permissions`, {
  headers: { cookie: cookieHeader },
});
const permissions = await json(permissionsResponse);
if (!permissions.permissions.includes('roles.manage'))
  throw new Error('Owner permissions are missing');

const settingsResponse = await fetch(`${baseUrl}/api/settings`, {
  headers: { cookie: cookieHeader },
});
const settings = await json(settingsResponse);
const smtpPassword = settings.items.find((item) => item.key === 'integrations.smtp-password');
if (!smtpPassword || smtpPassword.sensitive !== true || 'value' in smtpPassword) {
  throw new Error('sensitive setting view is not safely masked');
}

const smokeSecret = 'docker-smoke-plaintext-secret';
const saveSettingResponse = await fetch(`${baseUrl}/api/settings/integrations.smtp-password`, {
  method: 'PUT',
  headers: {
    cookie: cookieHeader,
    'content-type': 'application/json',
    'x-csrf-token': identity.csrfToken,
  },
  body: JSON.stringify({ value: smokeSecret }),
});
const savedSetting = await json(saveSettingResponse);
if (
  savedSetting.source !== 'database' ||
  savedSetting.maskedValue !== '••••••••' ||
  JSON.stringify(savedSetting).includes(smokeSecret)
) {
  throw new Error('sensitive setting save exposed plaintext');
}

const auditResponse = await fetch(
  `${baseUrl}/api/audit?action=settings.updated&resourceType=setting`,
  { headers: { cookie: cookieHeader } },
);
const audit = await json(auditResponse);
if (
  audit.items.length !== 1 ||
  audit.items[0].resourceId !== 'integrations.smtp-password' ||
  !audit.items[0].requestId
) {
  throw new Error('setting modification audit event is missing');
}

const queuedAt = performance.now();
const mailResponse = await fetch(`${baseUrl}/api/mail/test`, {
  method: 'POST',
  headers: {
    cookie: cookieHeader,
    'content-type': 'application/json',
    'x-csrf-token': identity.csrfToken,
  },
  body: JSON.stringify({ to: email }),
});
const queuedMail = await json(mailResponse);
if (performance.now() - queuedAt > 1_500 || queuedMail.delivery.status !== 'queued') {
  throw new Error('mail enqueue blocked the HTTP request or did not return queued state');
}

async function waitFor(description, operation, attempts = 50) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await operation();
    if (result) return result;
    if (attempt === attempts) throw new Error(`timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const resetQueuedAt = performance.now();
const resetRequest = await json(
  await fetch(`${baseUrl}/api/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  }),
);
if (
  resetRequest.accepted !== true ||
  'testToken' in resetRequest ||
  performance.now() - resetQueuedAt > 1_500
) {
  throw new Error('password reset did not securely enqueue its mail');
}

const resetMail = await waitFor('password reset mail delivery', async () => {
  const response = await fetch(`${baseUrl}/api/mail/deliveries?status=sent`, {
    headers: { cookie: cookieHeader },
  });
  const body = await json(response);
  return body.items.find((item) => item.recipient === email && item.template === 'password-reset');
});
if (!resetMail.simulated) throw new Error('password reset bypassed the configured mail adapter');

const deliveredMail = await waitFor('queued mail delivery', async () => {
  const response = await fetch(`${baseUrl}/api/mail/deliveries?status=sent`, {
    headers: { cookie: cookieHeader },
  });
  const body = await json(response);
  return body.items.find((item) => item.id === queuedMail.delivery.id);
});
if (!deliveredMail.simulated) throw new Error('log mail transport did not expose simulated state');

const jobsResponse = await fetch(`${baseUrl}/api/jobs?type=mail.send`, {
  headers: { cookie: cookieHeader },
});
const mailJobs = await json(jobsResponse);
const mailJob = mailJobs.items.find((item) => item.id === queuedMail.delivery.jobId);
if (!mailJob || mailJob.status !== 'succeeded' || mailJob.attempts !== 1) {
  throw new Error('mail job was duplicated or did not succeed');
}

const announcementBody = {
  recipientUserId: identity.user.id,
  category: 'smoke',
  level: 'info',
  title: 'Stage 5 smoke notification',
  body: 'Transactional outbox delivery',
  dedupeKey: 'docker-stage5-smoke-notification',
};
async function announce() {
  return json(
    await fetch(`${baseUrl}/api/notifications/announcements`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
        'content-type': 'application/json',
        'x-csrf-token': identity.csrfToken,
      },
      body: JSON.stringify(announcementBody),
    }),
  );
}
const firstAnnouncement = await announce();
const duplicateAnnouncement = await announce();
if (firstAnnouncement.id !== duplicateAnnouncement.id) {
  throw new Error('announcement idempotency returned different records');
}

const deliveredNotification = await waitFor('outbox notification delivery', async () => {
  const response = await fetch(`${baseUrl}/api/notifications`, {
    headers: { cookie: cookieHeader },
  });
  const body = await json(response);
  const matching = body.items.filter((item) => item.dedupeKey === announcementBody.dedupeKey);
  if (matching.length > 1) throw new Error('notification dedupe key created duplicates');
  return matching[0];
});

const unreadResponse = await fetch(`${baseUrl}/api/notifications/unread-count`, {
  headers: { cookie: cookieHeader },
});
const unread = await json(unreadResponse);
if (unread.count < 1) throw new Error('notification unread counter was not incremented');

await json(
  await fetch(`${baseUrl}/api/notifications/${deliveredNotification.id}/read`, {
    method: 'POST',
    headers: { cookie: cookieHeader, 'x-csrf-token': identity.csrfToken },
  }),
);
await json(
  await fetch(`${baseUrl}/api/notifications/${deliveredNotification.id}/archive`, {
    method: 'POST',
    headers: { cookie: cookieHeader, 'x-csrf-token': identity.csrfToken },
  }),
);

const outboxResponse = await fetch(`${baseUrl}/api/outbox?topic=notifications.create`, {
  headers: { cookie: cookieHeader },
});
const outbox = await json(outboxResponse);
const notificationEvent = outbox.items.find((item) => item.id === firstAnnouncement.outboxEventId);
if (
  !notificationEvent ||
  notificationEvent.status !== 'published' ||
  notificationEvent.attempts !== 1
) {
  throw new Error('outbox event was duplicated or not published');
}

const csrfRejected = await fetch(`${baseUrl}/api/auth/logout`, {
  method: 'POST',
  headers: { cookie: cookieHeader },
});
if (csrfRejected.status !== 403) {
  throw new Error(`logout without CSRF protection returned ${csrfRejected.status}`);
}

const logout = await fetch(`${baseUrl}/api/auth/logout`, {
  method: 'POST',
  headers: { cookie: cookieHeader, 'x-csrf-token': identity.csrfToken },
});
await json(logout);

const revoked = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: cookieHeader } });
if (revoked.status !== 401) throw new Error(`revoked session returned ${revoked.status}`);

console.log(
  'identity, access-control, settings, audit, jobs, outbox, mail, and notifications smoke test passed',
);
