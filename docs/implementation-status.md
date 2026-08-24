# Implementation status and handoff

Last verified: 2026-08-24 (Asia/Shanghai)

This is the durable continuation record for a developer or a later AI session. Read it with
[`implementation-plan.md`](./implementation-plan.md) and
[`async-foundation.md`](./async-foundation.md). Do not reassess completed stages from zero unless a
recorded check fails or Git history no longer matches this state.

## Current conclusion

Stages 0 through 5 are implemented. Stage 5 delivers PostgreSQL Jobs, Transactional Outbox, Mail,
Notifications, shared contracts/API Client, and the corresponding Admin pages. The next planned
work is Stage 6: Object Storage.

Stage 4 is committed and pushed at `52c71d4` (`feat: add settings and audit foundation`). Stage 5 was
implemented on that baseline and passed the complete acceptance set below. Its delivery commit is
`feat: add jobs, outbox, mail, and notifications`.

| Stage | Scope                                       | Status   |
| ----- | ------------------------------------------- | -------- |
| 0     | Independent repository baseline             | Complete |
| 1     | Contracts and database conventions          | Complete |
| 2     | Identity and Access Control                 | Complete |
| 3     | Shared frontend, Admin, and Web foundations | Complete |
| 4     | Settings and Audit                          | Complete |
| 5     | Jobs, Outbox, Mail, and Notifications       | Complete |
| 6     | Object Storage                              | Next     |

Progress is **6 of 9 stages (66.7%)** by stage count. The workload-weighted estimate is
approximately **62%** because Payments and final product delivery remain larger than an average
stage.

## Stage 5 delivered scope

### PostgreSQL Jobs and Worker

- `jobs` and immutable-per-generation `job_attempts` history in migration
  `server/drizzle/0003_great_microchip.sql`.
- Scheduled and priority claims through `FOR UPDATE SKIP LOCKED`; multiple Workers do not claim the
  same execution.
- Configurable attempts, exponential backoff with jitter, heartbeat, stale-lock recovery, and dead
  state.
- Manual retry is restricted to dead jobs. It increments `generation` and retains earlier attempts.
- Optional producer idempotency keys, handler registry, recurring-job registry, and audit events for
  retry/dead outcomes.
- A real standalone Worker application context with startup dependency-graph regression coverage and
  a production container health check.

### Transactional Outbox

- `OutboxService.append` requires the caller's database transaction; business data and the event
  commit or roll back together.
- Topic handler registry, locked claims, retry/backoff, stale recovery, dead state, Dedupe Key, Admin
  inspection, and dead-event retry.
- The notification announcement is the reference transaction: announcement plus Outbox event are
  committed together.

### Mail

- `MailPort` and configurable `log`/`smtp` adapter. SMTP uses the published
  `@lingcoo-tech/mailer@0.1.1`; no SMTP transport was copied into this repository.
- Queueing persists delivery, `mail.send` job, and audit event in one transaction. SMTP never blocks
  the originating HTTP request.
- Password-reset and email-verification requests enqueue real action links derived from
  `PUBLIC_WEB_URL`; administrator-invite and test templates are also available.
- Registered SMTP Settings definitions with environment fallbacks. The password remains encrypted
  by Settings; API delivery views never expose message bodies.
- The Settings connection test sends through the public mail package. `MAIL_TRANSPORT=log` safely
  records simulated delivery for local development and smoke tests.

### Notifications

- Per-user list, unread count, mark-read, and archive APIs.
- Permission-protected Admin announcement creation.
- Consumer-level idempotency enforced by the unique `(recipient_user_id, dedupe_key)` index. Replayed
  Outbox events do not duplicate a notification.

### Contracts, client, and Admin

- Runtime Zod contracts and API Client methods/hooks for Jobs, Outbox, Mail, and Notifications.
- Permission-protected Admin routes for `/admin/jobs`, `/admin/mail`, and `/admin/notifications`.
- Job/Outbox status and dead retry, mail delivery/test view, and notification announcement/center
  foundation.

## Stable interfaces

| Method | Path                               | Access/permission      | Purpose                 |
| ------ | ---------------------------------- | ---------------------- | ----------------------- |
| GET    | `/api/jobs`, `/api/jobs/:id`       | `jobs.read`            | Inspect jobs/attempts   |
| POST   | `/api/jobs/:id/retry`              | `jobs.manage`          | Retry a dead job        |
| GET    | `/api/outbox`, `/api/outbox/:id`   | `jobs.read`            | Inspect Outbox events   |
| POST   | `/api/outbox/:id/retry`            | `jobs.manage`          | Retry a dead event      |
| GET    | `/api/mail/deliveries[/:id]`       | `integrations.manage`  | Inspect safe mail views |
| POST   | `/api/mail/test`                   | `integrations.manage`  | Queue a test message    |
| GET    | `/api/notifications`               | Authenticated          | List own notifications  |
| GET    | `/api/notifications/unread-count`  | Authenticated          | Own unread count        |
| POST   | `/api/notifications/:id/read`      | Authenticated + CSRF   | Mark own item read      |
| POST   | `/api/notifications/:id/archive`   | Authenticated + CSRF   | Archive own item        |
| POST   | `/api/notifications/announcements` | `notifications.manage` | Publish an announcement |

Database ownership added in Stage 5:

- Jobs: `jobs`, `job_attempts`;
- Outbox: `outbox_events`;
- Mail: `mail_deliveries`;
- Notifications: `notification_announcements`, `notifications`.

## Environment and operations

- `PUBLIC_WEB_URL`: externally reachable Web root for reset/verification links;
- `MAIL_TRANSPORT`: `log` or `smtp`, default `log`;
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`;
- `JOB_POLL_INTERVAL_MS`, `JOB_BATCH_SIZE`, `JOB_LOCK_TIMEOUT_SECONDS`;
- `JOB_HEARTBEAT_INTERVAL_MS`, `JOB_BACKOFF_BASE_MS`, `JOB_BACKOFF_MAX_MS`;
- optional `JOB_WORKER_ID`; omit it when scaling so each process generates a unique ID.

The heartbeat interval must be below the lock timeout. `docker-compose.prod.yml` runs API and Worker
from the same image with separate commands. Scale Worker horizontally only against the same database
and configuration.

## Public package adoption

Published packages are used rather than copied or wrapped:

- `@lingcoo-tech/security@0.1.1`: password hashing and verification;
- `@lingcoo-tech/http@0.1.1`: framework-neutral HTTP errors/envelopes;
- `@lingcoo-tech/crypto@0.1.1`: authenticated Settings encryption;
- `@lingcoo-tech/mailer@0.1.1`: provider-neutral mail contract and SMTP adapter.

Application templates, persistence, NestJS orchestration, retries, audit, and Admin UI correctly
remain in this application repository. `/Users/admin/Projects/ts-app-packages` was not modified.

## Acceptance evidence

The final Stage 5 acceptance set is:

```bash
corepack pnpm check
corepack pnpm check:boundaries
corepack pnpm smoke:module-generator
corepack pnpm smoke:generated
corepack pnpm smoke:docker
git diff --check
```

All commands passed on 2026-08-24. Automated test count: 50 (Server 34, Contracts 9, API Client 4,
UI 2, Design Tokens 1). The generated-project smoke repeated its own install, formatting, lint,
typecheck, 50 tests, and production build in a newly generated standalone project.

The Docker production smoke uses real PostgreSQL and the production image. It starts two Worker
replicas and proves concurrent claim safety, a two-attempt dead job, stale-lock recovery, preserved
attempt records, transactionally joined announcement/Outbox rows, one deduplicated notification,
one-attempt Outbox publication, asynchronous test and password-reset mail, hidden production test
tokens, encrypted Settings, append-only Audit, idempotent Bootstrap, health checks, and Admin/Web SPA
routes. It removes the smoke containers, volumes, network, and image in `finally`.

During implementation the smoke test exposed and drove fixes for a missing Worker `AuditModule`
dependency, an ineffective Worker health check, and double transformation of notification boolean
query values. Regression tests now cover the Worker dependency graph and the boolean contract.

## Known delivery semantics

- Jobs and Outbox are at least once; every handler must be idempotent.
- SMTP may duplicate after the provider accepts a message but before the Worker commits success. The
  public package has no provider idempotency API, so this limitation is documented rather than hidden.
- Outbox consumers are expected to finish within the lock timeout; stale processing is recovered.
- Admin pages are operational foundations, not the final Stage 8 product UX/browser E2E suite.

## Stage 6 next tasks

Implement Object Storage as one complete vertical slice:

1. Define provider-neutral object metadata, upload authorization, access URL, and deletion contracts.
2. Add `ObjectStoragePort` plus local-development and Qiniu adapters without leaking provider
   credentials or protocols into Controllers.
3. Enforce MIME allowlists, maximum sizes, path-prefix ownership, public/private policies, and
   short-lived upload authorization.
4. Persist object metadata and audit configuration tests, authorization creation, and destructive
   operations.
5. Register encrypted Settings definitions with environment fallbacks and provider connection tests.
6. Add API Client support and an Admin media picker with upload, search, selection, and safe deletion.
7. Extend unit/integration coverage, generated-project smoke, and Docker production smoke for both
   local and configured-provider boundaries.

## Resume protocol

1. Read this document, `implementation-plan.md`, and `async-foundation.md`.
2. Run `git status --short` and `git log -5 --oneline`.
3. Confirm Git history contains `feat: add jobs, outbox, mail, and notifications` after `52c71d4`.
4. If toolchain, dependency, Docker, or Stage 5 code changes, rerun the full acceptance set above.
5. Start Stage 6 at `ObjectStoragePort`, local/Qiniu adapters, upload
   authorization, object metadata, security limits, Settings test, and Admin media picker.
6. Reuse a published storage package only if its public API covers the required boundary; do not copy
   or prematurely extract application-specific code.
