# Identity and Access Control

## Model

- `IdentityModule` owns accounts, password credentials, sessions, password-reset tokens, and email-verification tokens.
- `AccessControlModule` owns permissions, roles, role assignments, the global authorization guard, and Bootstrap.
- Password hashing comes from `@lingcoo-tech/security`; NestJS owns application orchestration and persistence.
- Raw session/reset/verification tokens never enter PostgreSQL. Only SHA-256 digests are stored.
- The browser receives a Secure HttpOnly session Cookie and a separate session-bound CSRF Cookie.

## API

| Method | Path                                   | Access                         |
| ------ | -------------------------------------- | ------------------------------ |
| POST   | `/api/auth/login`                      | Public, strict rate limit      |
| GET    | `/api/auth/me`                         | Authenticated                  |
| POST   | `/api/auth/logout`                     | Authenticated + `X-CSRF-Token` |
| POST   | `/api/auth/password/change`            | Authenticated + `X-CSRF-Token` |
| POST   | `/api/auth/password-reset/request`     | Public, generic response       |
| POST   | `/api/auth/password-reset/confirm`     | Public, one-time token         |
| POST   | `/api/auth/email-verification/request` | Authenticated + `X-CSRF-Token` |
| POST   | `/api/auth/email-verification/confirm` | Public, one-time token         |
| GET    | `/api/access/permissions`              | Authenticated                  |

All NestJS routes are protected unless they explicitly use `@Public()`. Protected unsafe methods
must send the CSRF Cookie value in `X-CSRF-Token`. Permission-protected handlers additionally use
`@RequirePermissions('resource.action')`.

## Bootstrap

After applying migrations:

```bash
pnpm db:bootstrap
```

The command always synchronizes the permission catalog and the system Owner role. When
`BOOTSTRAP_OWNER_EMAIL` and `BOOTSTRAP_OWNER_PASSWORD` are configured together, it creates or reuses
that account and assigns Owner. It is idempotent and never overwrites an existing password.

Production must use Secure Cookies and must never enable `AUTH_EXPOSE_TEST_TOKENS`. The latter is a
development bridge until Mail and Transactional Outbox are delivered; it allows local clients to
exercise reset and verification flows without SMTP.

Keep `AUTH_COOKIE_SAME_SITE=lax` when Admin/Web and API are same-site. A genuinely cross-site
frontend may set it to `none`, which configuration validation permits only with Secure Cookies.
Using custom frontend and API domains under the same parent site is preferable to depending on
third-party Cookie behavior.

## Extending permissions

Add application-generic permissions to `SYSTEM_PERMISSIONS`. Generated industry applications may
extend that catalog with their own permission synchronization, but must not add education or retail
roles back to this Starter. Identity remains independent of role naming and authorization policy.
