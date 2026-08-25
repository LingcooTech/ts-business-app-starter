# Payments

Stage 7 adds a provider-neutral payment infrastructure slice. It owns provider communication,
payment intent and refund ledgers, callback verification, reconciliation, Audit, Jobs, and
Transactional Outbox events. It deliberately does not own or mutate education, retail,
subscription, inventory, entitlement, contract, or other industry orders.

## Dependency decision

The implementation reuses mature protocol libraries instead of rebuilding signing and encryption:

- `alipay-sdk@4.14.0`: Alipay's official Node.js SDK for RSA2 signing, callback verification,
  page-payment URLs, query, close, and refunds;
- `wechatpay-axios-plugin@0.9.6`: maintained TypeScript API v3 client for request signing, response
  verification, RSA callback verification, and AES-256-GCM notification decryption;
- `fastify-raw-body@6.0.1`: captures the exact callback body only on payment callback routes.

Application-owned code remains responsible for state transitions, idempotency, database
constraints, compensation, permissions, encrypted settings, and industry-neutral events.

## Provider boundary

`PaymentProviderPort` exposes create, query, close, refund, refund query, callback verification, and
connection testing. The current adapters are:

- `mock`: deterministic non-production development and test adapter;
- `alipay`: Alipay page payment and refund operations through the official SDK;
- `wechat`: WeChat Pay API v3 Native payment and domestic refunds.

The Mock adapter is rejected whenever `NODE_ENV=production`, including when explicitly requested by
an authenticated administrator.

## Data and money rules

PostgreSQL owns three tables:

- `payment_intents`: provider-neutral merchant payment ledger;
- `payment_refunds`: idempotent refund requests and provider results;
- `payment_callbacks`: callback event IDs, body SHA-256, processing state, and linked records.

Money is always stored as an integer number of CNY minor units. Floating-point amounts are used only
at the Alipay protocol boundary and are converted with two fixed decimal places. Database checks
reject non-positive amounts and prevent the accumulated refunded amount from exceeding the payment
amount.

Merchant order IDs, merchant refund IDs, provider transaction IDs, provider refund IDs, and provider
callback event IDs have database uniqueness constraints. Reusing a merchant ID with different
payment or refund data is rejected as an idempotency conflict.

## Callback security

Provider callbacks are public HTTP routes but are not trusted input:

1. Capture the exact raw request body for signature verification.
2. Verify Alipay RSA2 signatures or WeChat Pay RSA signatures before persistence or state changes.
3. Enforce WeChat callback timestamp tolerance and decrypt API v3 resources with AES-256-GCM.
4. Verify configured Alipay App ID or WeChat merchant/App IDs.
5. Verify provider, merchant IDs, amount, currency, provider transaction/refund IDs, and legal state
   transitions while holding database locks.
6. Store only the body SHA-256 and bounded metadata, not the full sensitive callback body.
7. Accept an already processed event without repeating state changes or Outbox publication.
8. Reject the same event ID when its body hash changes. A failed callback with the same body can be
   claimed again for provider retry.

## Crash compensation and reconciliation

Creating a payment intent and scheduling `payment.reconcile` plus `payment.close-expired` happens in
one database transaction before the provider call. Creating a refund and scheduling
`payment.refund-reconcile` follows the same rule. This removes the crash window where a durable local
record could exist without a recovery job.

Reconciliation safely reuses the merchant order/refund ID:

- a `created` payment retries provider creation;
- a `pending` payment queries provider state;
- a `pending` refund retries the provider refund request with the same merchant refund ID;
- expired `created` or `pending` payments are closed by a scheduled job.

Provider failures preserve a recoverable local state and record the bounded error instead of
prematurely converting an uncertain request into a terminal failure.

## Events and industry boundary

Successful payments append `payments.succeeded`; successful refunds append `payments.refunded`.
Both use Transactional Outbox dedupe keys in the same transaction as the state update. The starter
registers no-op handlers so the generic events can be published before a generated application adds
its industry consumer.

An industry module must consume these events and decide how its own order, entitlement, inventory,
subscription, or contract changes. The Payments module never performs those changes directly.

## HTTP API

| Method | Path                                     | Permission        | Purpose                  |
| ------ | ---------------------------------------- | ----------------- | ------------------------ |
| GET    | `/api/payments/intents`                  | `payments.read`   | Search payment intents   |
| POST   | `/api/payments/intents`                  | `payments.manage` | Create a payment intent  |
| GET    | `/api/payments/intents/:id`              | `payments.read`   | Read one intent          |
| POST   | `/api/payments/intents/:id/query`        | `payments.manage` | Query provider state     |
| POST   | `/api/payments/intents/:id/close`        | `payments.manage` | Close a payment          |
| POST   | `/api/payments/intents/:id/mock-succeed` | `payments.manage` | Non-production fixture   |
| POST   | `/api/payments/intents/:id/refunds`      | `payments.manage` | Request a refund         |
| GET    | `/api/payments/refunds`                  | `payments.read`   | Search refunds           |
| POST   | `/api/payments/refunds/:id/query`        | `payments.manage` | Query a refund           |
| POST   | `/api/payments/callbacks/alipay`         | Public + RSA2     | Alipay asynchronous push |
| POST   | `/api/payments/callbacks/wechat`         | Public + API v3   | WeChat asynchronous push |

`/admin/payments` exposes creation, query, close, non-production Mock success, refund, and refund
query operations according to the effective permission set.

## Configuration

Common settings:

- `PAYMENT_PROVIDER`: `mock`, `alipay`, or `wechat`;
- `PAYMENT_NOTIFY_BASE_URL`: externally reachable API root;
- `PAYMENT_CALLBACK_TOLERANCE_SECONDS`: WeChat callback time window, default `300`.

Alipay:

- `PAYMENT_ALIPAY_APP_ID`;
- `PAYMENT_ALIPAY_PRIVATE_KEY`;
- `PAYMENT_ALIPAY_PUBLIC_KEY`;
- `PAYMENT_ALIPAY_GATEWAY`;
- `PAYMENT_ALIPAY_RETURN_URL`.

WeChat Pay API v3:

- `PAYMENT_WECHAT_MCH_ID`;
- `PAYMENT_WECHAT_APP_ID`;
- `PAYMENT_WECHAT_MERCHANT_SERIAL`;
- `PAYMENT_WECHAT_PRIVATE_KEY`;
- `PAYMENT_WECHAT_PLATFORM_CERTIFICATES`: JSON serial-to-PEM object;
- `PAYMENT_WECHAT_API_V3_KEY`: exactly 32 bytes.

Credentials can be database overrides encrypted by Settings or environment fallbacks. Production
configuration should select one real provider and keep all keys in a secret manager or protected
environment file. Rotating a WeChat platform certificate means temporarily retaining every accepted
serial in the certificate JSON until old callbacks are no longer possible.

## Operational notes

- Provider create/refund APIs must preserve merchant-ID idempotency; do not replace IDs during retry.
- Callback endpoints must remain behind a proxy that preserves body bytes and provider signature
  headers.
- Worker and API must use the same database and payment Settings encryption keys.
- Payment events are infrastructure facts, not proof that an industry order transition succeeded.
- Provider sandboxes and real merchant credentials require a deployment-specific acceptance pass
  outside this repository's deterministic fixture tests.
