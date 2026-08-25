# Product delivery and upgrade guide

Stage 8 turns the starter repository into a repeatable product delivery unit. The repository now
has a published CLI surface, a browser acceptance entry point, generated-project checks, and an
explicit deployment/upgrade sequence.

## CLI delivery

Generate a standalone project from the published package:

```bash
npx @lingcoo-tech/create-ts-business-app-starter@latest my-business-app
```

The CLI refuses to write into a non-empty directory. Use `--force` only when the target is known to
be disposable or intentionally being replaced:

```bash
npx @lingcoo-tech/create-ts-business-app-starter@latest my-business-app --force
```

The generated project removes maintainer-only version checks and generator smoke scripts, replaces
workspace/package/environment identities, excludes local state and build output, and initializes a
standalone Git repository unless `--no-git` is supplied.

## First boot

```bash
cp .env.example .env
# Set DATABASE_URL, SETTINGS_ENCRYPTION_KEYS, and the bootstrap owner credentials.
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:migrate
pnpm db:bootstrap
pnpm db:bootstrap
pnpm dev
```

The repeated migration and bootstrap commands are intentional idempotency checks. Production
deployments use the same migration/bootstrap commands before starting the API and Worker.

## Browser acceptance

Browser tests use the mature Playwright Test runner; the application itself remains framework-owned.
`docker-compose.e2e.yml` is the explicit non-production override that enables insecure local cookies
and Mock payment without weakening `docker-compose.prod.yml`. Start a local stack or point the tests
at an existing environment:

```bash
pnpm e2e:install
E2E_BASE_URL=http://127.0.0.1:18193 \
E2E_OWNER_EMAIL=owner@example.com \
E2E_OWNER_PASSWORD='replace-with-demo-password' \
pnpm e2e
```

The suite covers administrator login, navigation to Settings, Jobs/Outbox, Storage, Payments, and
Audit, plus creating and completing a Mock payment through the visible UI. Mock payment is only
valid in a development/test environment; never enable it for production traffic.

## Release gate

Run the following before publishing a starter or runtime image:

```bash
pnpm check
pnpm check:boundaries
pnpm smoke:cli-release
pnpm smoke:module-generator
pnpm smoke:generated
pnpm smoke:docker
git diff --check
```

The CLI release smoke verifies npm package contents, package identity, non-empty target protection,
maintainer-file removal, and generation from the local template. The generated-project smoke then
installs the independent project and runs its complete quality check.

## Deployment and upgrade

1. Build and tag the immutable runtime image with the full Git SHA.
2. Back up PostgreSQL and archive the current image tag and environment configuration.
3. Pull the new image, start PostgreSQL, run `node server/dist/migrate.js`, then run
   `node server/dist/bootstrap.js`.
4. Start the API and Worker, wait for `/health/ready`, and run `deploy/scripts/verify-deployment.sh`.
5. For provider changes, run the Settings connection test and a sandbox/low-value provider check
   before enabling production traffic.
6. For rollback, restore the previous image tag and environment revision. Do not roll back a schema
   migration blindly; restore the database backup or apply a forward-compatible repair migration.

Database migrations are append-only and run before application rollout. Keep the previous image
available until health checks and provider callbacks have passed acceptance.

## Credential rotation

Provider credentials may come from encrypted Settings or environment fallbacks. Prefer writing a new
credential, testing the provider connection, deploying the new runtime revision, and then removing
the old credential. Secrets are never committed to the repository or printed by the Admin UI.
