# Implementation status and handoff

Last verified: 2026-08-25 (Asia/Shanghai)

This is the durable continuation record for a developer or later AI session. Read it with
[`implementation-plan.md`](./implementation-plan.md), [`async-foundation.md`](./async-foundation.md),
[`object-storage.md`](./object-storage.md), and [`payments.md`](./payments.md). Do not reassess
completed stages from zero unless a recorded check fails or Git history no longer matches this state.

## Current conclusion

Stages 0 through 7 are implemented. Stage 7 delivers provider-neutral Payments with mature Alipay
and WeChat dependencies, payment/refund ledgers, callback security, idempotency, compensation Jobs,
Transactional Outbox events, encrypted Settings, API Client support, and `/admin/payments`.

Stage 6 is committed and pushed at `e44a92b` (`feat: add multi-provider object storage`). Stage 7 is
delivered by the subsequent `feat: add provider-neutral payments` change.

| Stage | Scope                                       | Status   |
| ----- | ------------------------------------------- | -------- |
| 0     | Independent repository baseline             | Complete |
| 1     | Contracts and database conventions          | Complete |
| 2     | Identity and Access Control                 | Complete |
| 3     | Shared frontend, Admin, and Web foundations | Complete |
| 4     | Settings and Audit                          | Complete |
| 5     | Jobs, Outbox, Mail, and Notifications       | Complete |
| 6     | Object Storage                              | Complete |
| 7     | Payments                                    | Complete |
| 8     | Product delivery and generator              | Next     |

Progress is **8 of 9 stages (88.9%)** by stage count. The workload-weighted estimate is
approximately **86%**. The remaining work is concentrated in generator/product delivery hardening,
full browser E2E, release packaging, and upgrade verification.

The original Desktop implementation plan numbers Object Storage as Stage 5 and Payments as Stage 6.
The repository plan includes an earlier frontend-foundation stage, so the same slices are numbered
Stage 6 and Stage 7 here.

## Stage 7 delivered scope

### Mature provider dependencies and application boundary

- `PaymentProviderPort` isolates provider-specific create, query, close, refund, refund-query,
  callback verification, and connection-test operations.
- `alipay-sdk@4.14.0`, Alipay's official Node.js SDK, owns RSA2 signing/verification and payment API
  protocol details.
- `wechatpay-axios-plugin@0.9.6` owns WeChat Pay API v3 request signing, response verification, RSA
  callback verification, and AES-256-GCM resource decryption.
- `fastify-raw-body@6.0.1` captures exact callback bytes only for callback routes.
- Mock remains deterministic for development and tests but is rejected in production.

### Payment, refund, and callback ledger

- `payment_intents`, `payment_refunds`, and `payment_callbacks` are owned by Payments.
- All money is integer CNY minor units; checks reject non-positive values and over-refunding.
- Unique merchant order/refund IDs, provider IDs, and callback event IDs enforce idempotency.
- Callback rows retain body SHA-256 and bounded errors, not full sensitive payloads.
- Migration `server/drizzle/0005_demonic_puff_adder.sql` also expands immutable Audit actors with
  `provider`.

### Security, state, and reliability

- Alipay RSA2 signatures and configured App ID are verified before state changes.
- WeChat timestamp tolerance, certificate serial, RSA signature, AES-GCM resource, merchant ID, and
  App ID are verified before state changes.
- Provider, amount, currency, transaction/refund IDs, and legal state transitions are verified while
  database rows are locked.
- Processed callback replays return success without duplicate state or Outbox effects; changed-body
  replays are rejected; rejected callbacks with the same body can be claimed again.
- Payment creation atomically schedules reconcile and expiry-close Jobs with the local intent.
- Refund creation atomically schedules refund reconciliation with the local refund.
- Reconciliation safely reuses merchant IDs for provider idempotency and preserves uncertain states
  after transport failures.

### Outbox, Settings, Audit, API, and Admin

- `payments.succeeded` and `payments.refunded` are appended through Transactional Outbox in the same
  transaction as state updates.
- Payment events contain only provider-neutral payment facts; the module does not own or mutate
  industry orders.
- Provider credentials use encrypted Settings with environment fallbacks and connection tests.
- Permissions `payments.read` and `payments.manage` protect APIs and the Admin route.
- Contracts and API Client cover intent/refund list, create, query, close, Mock success, and refund.
- `/admin/payments` provides operations and provider-neutral status views.

## Stable interfaces

| Method | Path                                     | Access/permission | Purpose                |
| ------ | ---------------------------------------- | ----------------- | ---------------------- |
| GET    | `/api/payments/intents`                  | `payments.read`   | Search payment intents |
| POST   | `/api/payments/intents`                  | `payments.manage` | Create payment intent  |
| GET    | `/api/payments/intents/:id`              | `payments.read`   | Read payment intent    |
| POST   | `/api/payments/intents/:id/query`        | `payments.manage` | Query provider state   |
| POST   | `/api/payments/intents/:id/close`        | `payments.manage` | Close payment          |
| POST   | `/api/payments/intents/:id/mock-succeed` | `payments.manage` | Non-production fixture |
| POST   | `/api/payments/intents/:id/refunds`      | `payments.manage` | Request refund         |
| GET    | `/api/payments/refunds`                  | `payments.read`   | Search refunds         |
| POST   | `/api/payments/refunds/:id/query`        | `payments.manage` | Query provider refund  |
| POST   | `/api/payments/callbacks/alipay`         | Public + RSA2     | Alipay callback        |
| POST   | `/api/payments/callbacks/wechat`         | Public + API v3   | WeChat callback        |

## Acceptance evidence

The final Stage 7 acceptance set is:

```bash
corepack pnpm check
corepack pnpm check:boundaries
corepack pnpm smoke:module-generator
corepack pnpm smoke:generated
corepack pnpm smoke:docker
git diff --check
```

All commands passed on 2026-08-25. The workspace test total is **67**: Server 45, Contracts 12,
API Client 7, UI 2, and Design Tokens 1. The generated standalone project repeated formatting,
Lint, type checking, the same 67 tests, and every production build.

Payment-specific automated coverage includes Contracts, state transitions, compensation scheduling,
idempotency conflicts, over-refund rejection, callback mismatch/replay behavior, production Mock
rejection, generated-key Alipay RSA2 fixtures, generated-key WeChat RSA/AES-GCM fixtures, and API
Client operations. Docker acceptance checks payment tables/constraints, production Mock rejection,
and the `/admin/payments` SPA route without weakening the production safety rule.

The production Docker smoke built the runtime image from scratch, migrated PostgreSQL, bootstrapped
the Owner, ran one API and two Worker replicas behind Caddy, exercised the existing application
smoke, proved production Mock rejection, verified all three payment tables and the provider Audit
constraint, checked `/admin/payments`, and removed all containers, networks, and volumes in `finally`.

## Known delivery semantics

- Real merchant credentials and provider console configuration cannot be committed; each deployment
  must perform an Alipay/WeChat sandbox or low-value acceptance before enabling production traffic.
- The built-in Alipay flow is page payment; the built-in WeChat flow is Native QR payment. Generated
  applications can add JSAPI, H5, Mini Program, App, or other products behind the same port.
- Payment/refund Outbox handlers are intentionally no-op until an industry module registers a
  consumer.
- Provider callbacks are only trustworthy when the reverse proxy preserves exact body bytes and
  required signature headers.
- The Admin payment page is an operational foundation; Stage 8 performs the final browser UX/E2E and
  generated-project product pass.

## Stage 8 next tasks

1. Harden the creation CLI's substitutions, package identity, environment templates, and migration
   bootstrap for the complete Stage 7 feature set.
2. Add Playwright browser E2E for login, permissions, Settings, Jobs, Storage, and Payments management.
3. Verify generated projects install, migrate twice, bootstrap an Owner, run API and Worker, and
   build Admin/Web without referencing the source repository.
4. Exercise release tarballs and `npx @lingcoo-tech/create-ts-business-app-starter@latest` from a clean
   environment.
5. Finalize deployment, upgrade, rollback, and provider credential rotation documentation.
6. Run the full CI/Docker/CLI acceptance matrix and publish the product delivery conclusion.

## Resume protocol

1. Read this document, `implementation-plan.md`, `payments.md`, and
   `payments-acceptance.md`.
2. Run `git status --short` and `git log -5 --oneline`.
3. Confirm Git history contains `feat: add provider-neutral payments` after `e44a92b`.
4. If toolchain, dependency, Docker, payment, storage, or generator code changes, rerun the full
   acceptance set above.
5. Start Stage 8 from generator substitution/packaging and Playwright browser coverage; do not reopen
   Payments unless a recorded acceptance fails.
