# Implementation status and handoff

Last verified: 2026-08-25 (Asia/Shanghai)

This is the durable continuation record for a developer or a later AI session. Read it with
[`implementation-plan.md`](./implementation-plan.md),
[`async-foundation.md`](./async-foundation.md), and
[`object-storage.md`](./object-storage.md). Do not reassess completed stages from zero unless a
recorded check fails or Git history no longer matches this state.

## Current conclusion

Stages 0 through 6 are implemented. Stage 6 delivers provider-neutral Object Storage, local and
S3-compatible adapters, upload/access authorization, metadata, security policies, Settings and
Audit integration, shared contracts/API Client, and the Admin media page. The next planned work is
Stage 7: Payments.

Stage 5 is committed and pushed at `3a7ae7d` (`feat: add jobs, outbox, mail, and notifications`).
Stage 6 was implemented on that baseline and passed the complete acceptance set below. Its delivery
commit is `feat: add multi-provider object storage`.

| Stage | Scope                                       | Status   |
| ----- | ------------------------------------------- | -------- |
| 0     | Independent repository baseline             | Complete |
| 1     | Contracts and database conventions          | Complete |
| 2     | Identity and Access Control                 | Complete |
| 3     | Shared frontend, Admin, and Web foundations | Complete |
| 4     | Settings and Audit                          | Complete |
| 5     | Jobs, Outbox, Mail, and Notifications       | Complete |
| 6     | Object Storage                              | Complete |
| 7     | Payments                                    | Next     |
| 8     | Product delivery and generator              | Planned  |

Progress is **7 of 9 stages (77.8%)** by stage count. The workload-weighted estimate is
approximately **72%** because payment callback security, provider fixtures, compensation workflows,
and final product delivery remain larger than an average stage.

The original Desktop implementation plan numbers Object Storage as Stage 5 and Payments as Stage 6.
The repository plan includes an earlier frontend-foundation stage, so the same slices are numbered
Stage 6 and Stage 7 here.

## Stage 6 delivered scope

### Provider boundary and mature dependencies

- `ObjectStoragePort` owns the application boundary; Controllers and Admin code do not depend on a
  provider SDK.
- The `local` adapter uses atomic temporary-file writes for development and single-host deployment.
- The `s3` adapter uses the official `@aws-sdk/client-s3@3.1117.0` and
  `@aws-sdk/s3-request-presigner@3.1117.0` instead of reimplementing signing, transport, or credential
  handling.
- Configurable region, endpoint, path-style mode, bucket, credentials, and public base URL cover AWS
  S3 and providers exposing an S3-compatible API without changing Controllers.
- `@fastify/multipart@9.2.1` provides bounded local multipart parsing.

### Upload, access, and metadata

- Server-generated object keys preserve only a safe extension and never use the submitted filename
  as a filesystem or provider path.
- Upload authorization validates declared byte size, MIME allowlists, logical prefix ownership, and
  public/private visibility before creating a `pending` metadata row.
- Local uploads enforce the authorization lifetime, use authenticated multipart upload, stream to a
  temporary file, verify size, and rename atomically.
- S3-compatible uploads use a short-lived presigned PUT URL; completion performs a provider HEAD and
  verifies size and content type before the object becomes `ready`.
- Public and private access URLs are provider-neutral. Local private content remains permission
  protected; S3-compatible private content uses a short-lived signed GET URL.
- Deletion removes the provider object before marking metadata `deleted`.

### Settings, Audit, contracts, and Admin

- Storage Settings definitions use database overrides, environment fallbacks, encrypted credentials,
  and the existing Settings connection-test workflow.
- Audit events cover upload authorization, ready completion, deletion, and provider connection tests.
- Runtime Zod contracts and API Client methods/hooks cover list, upload, access, and deletion.
- Permissions `storage.read` and `storage.manage` protect the API and Admin route.
- `/admin/storage` provides upload, list, selection, access, status, visibility, and safe deletion.
- Production Compose mounts a persistent `storage_data` volume, and the non-root runtime image
  pre-creates a writable `/app/storage` mount point.

## Stable interfaces

| Method | Path                                | Access/permission  | Purpose                         |
| ------ | ----------------------------------- | ------------------ | ------------------------------- |
| GET    | `/api/storage/objects`              | `storage.read`     | Search object metadata          |
| GET    | `/api/storage/objects/:id`          | `storage.read`     | Read one metadata record        |
| POST   | `/api/storage/uploads`              | `storage.manage`   | Create upload authorization     |
| POST   | `/api/storage/uploads/:id/content`  | `storage.manage`   | Stream an authorized local file |
| POST   | `/api/storage/uploads/:id/complete` | `storage.manage`   | Verify provider upload          |
| GET    | `/api/storage/objects/:id/access`   | `storage.read`     | Create an access URL            |
| GET    | `/api/storage/objects/:id/content`  | `storage.read`     | Stream private local content    |
| GET    | `/api/storage/public/:id`           | Public object only | Stream public local content     |
| DELETE | `/api/storage/objects/:id`          | `storage.manage`   | Delete provider data + metadata |

Database ownership added in Stage 6:

- Object Storage: `storage_objects`.

## Environment and operations

- `STORAGE_PROVIDER`: `local` or `s3`, default `local`;
- `STORAGE_LOCAL_ROOT`: local filesystem root;
- `STORAGE_MAX_UPLOAD_BYTES`, `STORAGE_UPLOAD_EXPIRY_SECONDS`,
  `STORAGE_ACCESS_EXPIRY_SECONDS`;
- `STORAGE_ALLOWED_MIME_TYPES`, `STORAGE_ALLOWED_PREFIXES`;
- `STORAGE_S3_REGION`, `STORAGE_S3_ENDPOINT`, `STORAGE_S3_BUCKET`;
- `STORAGE_S3_ACCESS_KEY`, `STORAGE_S3_SECRET_KEY`, `STORAGE_S3_FORCE_PATH_STYLE`;
- `STORAGE_PUBLIC_BASE_URL`: optional public bucket or CDN root.

Local storage is suitable for development or one API host. Multi-host and independently scaled API
deployments should use shared S3-compatible storage. Full configuration and security semantics are
documented in [`object-storage.md`](./object-storage.md).

## Public package adoption

Published packages are used rather than copied or reimplemented:

- `@lingcoo-tech/security@0.1.1`: password hashing and verification;
- `@lingcoo-tech/http@0.1.1`: framework-neutral HTTP errors/envelopes;
- `@lingcoo-tech/crypto@0.1.1`: authenticated Settings encryption;
- `@lingcoo-tech/mailer@0.1.1`: provider-neutral mail contract and SMTP adapter;
- `@aws-sdk/client-s3@3.1117.0`: S3-compatible object operations;
- `@aws-sdk/s3-request-presigner@3.1117.0`: short-lived PUT/GET authorization;
- `@fastify/multipart@9.2.1`: bounded streaming multipart ingestion.

Application metadata, authorization policy, persistence, NestJS orchestration, audit, and Admin UI
correctly remain in this application repository.

## Acceptance evidence

The final Stage 6 acceptance set is:

```bash
corepack pnpm check
corepack pnpm check:boundaries
corepack pnpm smoke:module-generator
corepack pnpm smoke:generated
corepack pnpm smoke:docker
git diff --check
```

All commands passed on 2026-08-25. Automated test count: 57 (Server 39, Contracts 10, API Client 5,
UI 2, Design Tokens 1). The generated-project smoke repeated installation, formatting, lint,
typecheck, tests, and production builds in a newly generated standalone project.

The Docker production smoke uses real PostgreSQL and the production image. In addition to all Stage
5 invariants, it proves local multipart upload, rejected disallowed MIME, server-generated keys,
metadata/ETag/size verification, public access, prefix filtering, provider deletion, three storage
Audit events, a non-root writable storage volume, health checks, and Admin/Web SPA routes. Smoke
resources are removed in `finally`.

During implementation the Docker smoke exposed and drove fixes for an overloaded-machine mail timing
threshold and a root-owned empty named volume that prevented the non-root API process from writing
`/app/storage`.

## Known delivery semantics

- Abandoned `pending` metadata rows are not automatically expired or garbage-collected yet.
- MIME metadata validation is not malware scanning or full magic-byte inspection.
- Local storage is single-host storage; use S3-compatible shared storage before scaling API replicas.
- S3 public URLs require a bucket/CDN policy that actually permits public reads; otherwise omit
  `STORAGE_PUBLIC_BASE_URL` and use signed access URLs.
- Admin media management is an operational foundation, not the final Stage 8 browser E2E/UX pass.

## Stage 7 next tasks

Implement Payments as one complete vertical slice:

1. Define provider-neutral payment intent, transaction, refund, callback, and reconciliation contracts.
2. Add `PaymentProviderPort` and a non-production Mock adapter for deterministic tests.
3. Add Alipay and WeChat Pay API v3 adapters through their maintained SDK/protocol boundaries.
4. Implement the payment state machine with strict amount, currency, provider, and transition checks.
5. Preserve callback raw bodies and implement signature verification, decryption, replay protection,
   and database idempotency before acknowledging callbacks.
6. Add query, close, refund, reconciliation, timeout, and compensation Jobs.
7. Publish payment success/refund events through Transactional Outbox without owning industry orders.
8. Add encrypted Settings, provider connection tests, API Client support, and Admin payment pages.
9. Add provider fixtures, failure-path tests, generated-project smoke, Docker smoke, and browser
   acceptance for the payment management flow.

## Resume protocol

1. Read this document, `implementation-plan.md`, `async-foundation.md`, and `object-storage.md`.
2. Run `git status --short` and `git log -5 --oneline`.
3. Confirm Git history contains `feat: add multi-provider object storage` after `3a7ae7d`.
4. If toolchain, dependency, Docker, or Stage 6 code changes, rerun the full acceptance set above.
5. Start Stage 7 at the payment contracts, state machine, callback security boundary, and Mock adapter.
6. Prefer maintained provider SDKs where they preserve raw callback verification and required API
   semantics; keep application state, idempotency, compensation, Outbox, and Admin logic local.
