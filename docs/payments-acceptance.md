# Stage 7 Payments development and acceptance conclusion

Date: 2026-08-25 (Asia/Shanghai)

## Final development conclusion

Stage 7 Payments is implemented as a complete vertical slice. The code uses mature provider
libraries where available and does not reimplement Alipay RSA2, WeChat API v3 request signing,
callback RSA verification, or AES-256-GCM notification decryption.

Delivered scope:

- provider-neutral contracts, state machine, repository, service, Controller, Worker handlers, API
  Client hooks, and Admin page;
- Mock, Alipay, and WeChat Pay adapters;
- payment creation, query, close, refund, refund query, callback processing, timeout close, and
  compensation reconciliation;
- strict integer-minor-unit money rules and database uniqueness/check constraints;
- raw-body signature verification, merchant identity checks, replay detection, failed-callback retry,
  amount/currency/provider/transaction validation, and legal state transitions;
- Transactional Outbox events for payment success and refund success;
- encrypted provider Settings, environment validation, connection tests, permissions, and Audit;
- production rejection of Mock operations;
- Drizzle migration `0005_demonic_puff_adder.sql`.

The module remains industry-neutral: it does not own or update education orders, retail sales,
subscriptions, inventory, entitlements, contracts, or other product state.

## Automated acceptance coverage

The payment-specific suite covers:

- valid/invalid payment and refund Contracts;
- legal and illegal payment state transitions;
- atomic scheduling of create/reconcile/expiry compensation;
- merchant order idempotency conflicts;
- refund over-allocation rejection;
- callback amount mismatch rejection and callback retry state;
- processed callback replay without duplicate Outbox publication;
- production Mock rejection;
- real generated-key Alipay RSA2 callback verification and App ID rejection;
- real generated-key WeChat Pay RSA verification plus AES-256-GCM decryption;
- API Client payment mutation paths and pre-request refund validation;
- production Docker schema constraints, Mock safety, and `/admin/payments` SPA routing.

## Acceptance commands

The final acceptance gate is:

```bash
corepack pnpm check
corepack pnpm check:boundaries
corepack pnpm smoke:module-generator
corepack pnpm smoke:generated
corepack pnpm smoke:docker
git diff --check
```

All commands passed on 2026-08-25. The workspace contains **67 passing tests**: Server 45,
Contracts 12, API Client 7, UI 2, and Design Tokens 1. The generated standalone project repeated
formatting, Lint, type checking, the same tests, and every production build. Production Docker
acceptance passed with real PostgreSQL, API, two Worker replicas, Caddy, payment schema checks,
production Mock rejection, and `/admin/payments` routing. Durable evidence is also recorded in
[`implementation-status.md`](./implementation-status.md).

## Residual external acceptance

Repository acceptance proves protocol fixtures and application invariants without real merchant
credentials. Before enabling a production merchant, run a provider-specific sandbox or low-value
acceptance for:

- provider console callback URL and certificate/public-key configuration;
- payment creation and browser/QR checkout;
- asynchronous success callback;
- query and close behavior;
- full and partial refunds plus refund callback/query;
- key/certificate rotation and proxy raw-body preservation.

These are deployment credential and provider-console checks, not missing Starter functionality.

## Final assessment

Stage 7 is functionally complete and accepted. The repository reaches 8 of 9 planned stages (88.9%).
The workload-weighted estimate is approximately 86%; Stage 8 product delivery, generator hardening,
browser E2E, release, and upgrade verification remain.
