# Jobs, Transactional Outbox, Mail, and Notifications

Stage 5 adds a PostgreSQL-backed asynchronous foundation without Redis or a second queue service.
The HTTP API only persists work. A separate NestJS application context in `server/src/worker.ts`
claims and executes it.

## Runtime model

```text
HTTP transaction ──▶ jobs / outbox_events ──▶ one or more workers
                         │                         │
                         ├── mail.send ────────────┤──▶ MailPort
                         └── notifications.create ┘──▶ notifications
```

Workers use `FOR UPDATE SKIP LOCKED`, so multiple replicas can claim different rows without
processing the same claim concurrently. Jobs have a stable ID, optional idempotency key, priority,
scheduled time, attempt limit, exponential backoff with jitter, heartbeat, stale-lock recovery, and
dead-letter state. Each execution is recorded in `job_attempts`. Retrying a dead job starts a new
generation and preserves the earlier attempt history.

Handlers are registered through `JobHandlerRegistry`; recurring producers use
`RecurringJobRegistry`. A handler must be idempotent because PostgreSQL job delivery is at least
once: a process can fail after an external side effect and before the successful database update.

## Transactional Outbox

`OutboxService.append(input, executor)` requires the caller's transaction executor. The business
row and `outbox_events` row therefore commit or roll back together. Outbox consumers are registered
by topic, use the same locked-claim/retry/dead-letter model, and must also be idempotent.

The notification announcement flow is the reference implementation: the announcement and
`notifications.create` event are inserted in one transaction. The consumer uses the unique
`(recipient_user_id, dedupe_key)` constraint, so replaying the event cannot create a second user
notification.

## Mail

`MailService.queue` persists the delivery, `mail.send` job, and queue audit event in one database
transaction. Password-reset, email-verification, administrator-invite, and test templates belong to
the application. SMTP transport does not: `ConfiguredMailAdapter` calls the published
`@lingcoo-tech/mailer` package through `MailPort`.

`MAIL_TRANSPORT=log` is the safe development default. It records a simulated successful delivery
without sending externally. `MAIL_TRANSPORT=smtp` uses these Settings definitions, with environment
fallbacks:

- `integrations.smtp-host` / `SMTP_HOST`;
- `integrations.smtp-port` / `SMTP_PORT`;
- `integrations.smtp-secure` / `SMTP_SECURE`;
- `integrations.smtp-user` / `SMTP_USER`;
- `integrations.smtp-password` / `SMTP_PASSWORD` (encrypted database override);
- `integrations.smtp-from` / `SMTP_FROM`.

The Settings connection test sends one real test message to the configured From address because the
public mail package intentionally exposes send, not a provider-specific verify operation. Use it
only when that side effect is expected.

`PUBLIC_WEB_URL` is the externally reachable Web origin used to build reset and verification links.
Those identity endpoints only wait for database enqueueing, never for SMTP. In production,
`AUTH_EXPOSE_TEST_TOKENS` must stay false.

SMTP has an unavoidable at-least-once edge: if the provider accepts a message and the worker dies
before marking the row sent, a later retry may send it again. Provider message IDs or provider-side
idempotency can be added behind `MailPort` when a selected provider supports them.

## Notifications and Admin

Authenticated users can list their notifications, get an unread count, mark one read, and archive
one. `notifications.manage` can create a deduplicated announcement. Admin pages provide job/outbox
inspection and dead-letter retry, mail test/delivery history, and notification/announcement views.
The shared Contracts and API Client own all request and response schemas; Admin does not implement a
second HTTP transport.

## Operations

Run the Worker separately from the API and scale it horizontally:

```bash
pnpm dev:worker
docker compose -f docker-compose.prod.yml up -d --scale worker=2
```

Important tuning variables are `JOB_POLL_INTERVAL_MS`, `JOB_BATCH_SIZE`,
`JOB_LOCK_TIMEOUT_SECONDS`, `JOB_HEARTBEAT_INTERVAL_MS`, `JOB_BACKOFF_BASE_MS`, and
`JOB_BACKOFF_MAX_MS`. The heartbeat interval must be lower than the lock timeout. Do not use a fixed
`JOB_WORKER_ID` when multiple replicas share a database; if omitted, each process generates one.

Migration `server/drizzle/0003_great_microchip.sql` owns `jobs`, `job_attempts`, `outbox_events`,
`mail_deliveries`, `notification_announcements`, and `notifications`.
