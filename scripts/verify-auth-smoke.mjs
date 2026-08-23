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

console.log('identity and access-control smoke test passed');
