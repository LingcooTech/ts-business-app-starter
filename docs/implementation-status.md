# Implementation status and handoff

Last verified: 2026-08-24 (Asia/Shanghai)

This document is the durable handoff for continuing development after an interrupted AI or developer
session. Read it together with [`implementation-plan.md`](./implementation-plan.md). Do not restart a
full repository assessment unless the recorded checks fail or Git history no longer matches this
state.

## Current conclusion

Stages 0 through 4 are complete. Stage 4 delivers the Settings and Audit foundation and has passed
the repository quality gate, generated-project smoke, and Docker production smoke. The next planned
work is Stage 5: PostgreSQL Jobs, Transactional Outbox, Mail, and Notifications.

The clean baseline before Stage 4 was commit `175432b` (`refactor: adopt shared http package`) on
`main`. Stage 4 is the commit containing this document with message
`feat: add settings and audit foundation`.

| Stage | Scope                                       | Status   |
| ----- | ------------------------------------------- | -------- |
| 0     | Independent repository baseline             | Complete |
| 1     | Contracts and database conventions          | Complete |
| 2     | Identity and Access Control                 | Complete |
| 3     | Shared frontend, Admin, and Web foundations | Complete |
| 4     | Settings and Audit                          | Complete |
| 5     | Jobs, Outbox, Mail, and Notifications       | Next     |

## Stage 4 delivered scope

### Settings

- Registered setting definitions with per-key Zod validation; arbitrary keys are rejected.
- Resolution order: database override, environment fallback, definition default, then unset.
- Optimistic version checks through `expectedVersion` for updates and clears.
- Sensitive values encrypted with `@lingcoo-tech/crypto` AES-256-GCM envelopes.
- Separate database columns for public JSON and encrypted JSON, enforced by check constraints.
- Versioned keyring with current Key ID, old-key decryption, and explicit transactional rotation.
- Sensitive API views expose only configuration state and `maskedValue`; the shared Zod contract
  rejects a sensitive response containing a `value` field.
- Extensible connection-test hook. No fake SMTP connection test is registered yet; the real tester
  belongs to Stage 5 MailModule.

Initial definitions are:

- `application.name` with `APP_NAME` fallback;
- `application.support-email` with `SUPPORT_EMAIL` fallback;
- `integrations.smtp-password` with `SMTP_PASSWORD` fallback and encrypted database override.

### Audit

- Append-only business audit events for `user`, `system`, and `job` actors.
- Action, resource, outcome, Request ID, IP address, User-Agent, and metadata.
- Recursive redaction for password, secret, token, authorization, cookie, credential, and private-key
  metadata fields.
- Query filtering, pagination, and detail API.
- Settings save, clear, connection test, and secret rotation explicitly produce audit events.
- Settings mutation and its audit event commit in the same PostgreSQL transaction.
- PostgreSQL trigger rejects every `UPDATE` or `DELETE` against `audit_logs`.

### Contracts, client, and Admin

- Contracts for setting views/mutations, key rotation, audit rows, filters, and pagination.
- API Client methods and TanStack Query hooks for Settings and Audit.
- Permission-protected Admin routes and navigation for `/admin/settings` and `/admin/audit`.
- Settings override, clear, mask, and rotate controls; audit search and result table.

The Admin pages are the planned Stage 4 foundation, not the final product UX. Provider-specific
forms, real SMTP testing, richer audit filters/detail dialogs, and browser E2E expand in later stages.

## Stable interfaces

### HTTP endpoints

| Method | Path                                   | Permission        | Purpose                 |
| ------ | -------------------------------------- | ----------------- | ----------------------- |
| GET    | `/api/settings`                        | `settings.read`   | List resolved views     |
| PUT    | `/api/settings/:key`                   | `settings.manage` | Save database override  |
| DELETE | `/api/settings/:key`                   | `settings.manage` | Clear database override |
| POST   | `/api/settings/:key/test`              | `settings.manage` | Run registered tester   |
| POST   | `/api/settings/actions/rotate-secrets` | `settings.manage` | Rotate old-key rows     |
| GET    | `/api/audit`                           | `audit.read`      | Filtered paginated list |
| GET    | `/api/audit/:id`                       | `audit.read`      | Audit event detail      |

### Database ownership

- Settings owns `system_settings`.
- Audit owns `audit_logs`.
- Migration: `server/drizzle/0002_common_black_widow.sql`.
- `system_settings.updated_by` references Identity users with `ON DELETE SET NULL`.
- Audit records intentionally have no mutable repository methods or foreign keys that could cascade
  historical deletion.

### Environment

Required in production:

- `SETTINGS_ENCRYPTION_CURRENT_KEY_ID`;
- `SETTINGS_ENCRYPTION_KEYS`, a JSON object mapping Key IDs to secrets of at least 32 characters.

Optional fallbacks:

- `SUPPORT_EMAIL`;
- `SMTP_PASSWORD`.

Docker Compose passes missing optional values as empty strings. Environment validation normalizes
those empty strings to `undefined`. Production startup rejects the checked-in development key,
malformed keyring JSON, short secrets, and a current Key ID absent from the keyring.

Rotation procedure:

1. Add the new key and retain every old key in `SETTINGS_ENCRYPTION_KEYS`.
2. Change `SETTINGS_ENCRYPTION_CURRENT_KEY_ID` to the new key.
3. Call the rotation endpoint as an account with `settings.manage`.
4. Verify `rotated` and audit events, then back up the database.
5. Remove an old key only after no row references its Key ID.

## Public package adoption

The application uses published packages instead of copying their primitives:

- `@lingcoo-tech/security@0.1.1`: password hashing and verification in Identity;
- `@lingcoo-tech/http@0.1.1`: framework-neutral errors, envelopes, and guards;
- `@lingcoo-tech/crypto@0.1.1`: authenticated encryption for Settings.

`@lingcoo-tech/mailer` is deliberately not installed yet. It is adopted with the real Stage 5
MailModule. The `/Users/admin/Projects/ts-app-packages` repository was not modified by Stage 4.

## Acceptance evidence

The following completed successfully on the recorded implementation:

```bash
corepack pnpm check
corepack pnpm check:boundaries
corepack pnpm smoke:module-generator
corepack pnpm smoke:generated
corepack pnpm smoke:docker
git diff --check
```

Final automated test count: 42.

- Server: 27 tests;
- Contracts: 8 tests;
- API Client: 4 tests;
- UI: 2 tests;
- Design Tokens: 1 test.

Docker production smoke proved all of the following against real PostgreSQL and the production image:

- migration succeeded and Bootstrap remained idempotent across two executions;
- API, Worker, Caddy, health endpoints, Identity, Access Control, Admin routes, Settings, and Audit
  were operational;
- a known plaintext setting value was absent from both `value_json` and `encrypted_value` text;
- the stored sensitive row used `encrypted_value` plus the expected `key_id` and a null public value;
- the API response contained only the mask;
- the setting update produced a queryable audit event with Request ID;
- direct SQL mutation failed with `audit_logs is append-only`;
- smoke containers, volumes, network, and image were removed after completion.

One issue was found by the first Docker run: empty optional environment values from Compose failed
validation. It was fixed by normalizing empty `SUPPORT_EMAIL` and `SMTP_PASSWORD` to `undefined`, with
a regression test. The successful Docker run occurred after this fix.

## Resume protocol

To continue without spending tokens re-evaluating completed stages:

1. Read this document and `docs/implementation-plan.md`.
2. Run `git status --short` and `git log -5 --oneline`.
3. Confirm the Stage 4 commit is present and the worktree is clean.
4. Start Stage 5 from its schema and transaction boundaries; do not rewrite Settings, Audit, HTTP,
   Identity, or Access Control unless a reproducible regression requires it.
5. Reuse `SettingsRegistry` for Mail configuration and its real connection tester.
6. Use `AuditService` for explicit Mail, Jobs, Outbox, and Notification business events.
7. Adopt `@lingcoo-tech/mailer`; do not copy SMTP transport code into the application.

The local Docker environment was cleaned after validation. Only the current project's development
PostgreSQL container/volume/network and the Node 24, PostgreSQL 17, and Caddy 2 base images were kept.
