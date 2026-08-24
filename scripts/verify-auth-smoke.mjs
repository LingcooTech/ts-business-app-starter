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

console.log('identity, access-control, settings, and audit smoke test passed');
