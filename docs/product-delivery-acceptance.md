# Stage 8 product delivery acceptance

Accepted on 2026-08-25 (Asia/Shanghai).

## Conclusion

Stage 8 is complete. The repository can be delivered as a standalone generator and production
runtime, and the generated project retains the complete identity, settings, asynchronous execution,
storage, and payment foundation without referencing the source repository.

## Functional acceptance

- The published CLI package contains only its declared executable, README, and package metadata.
- Non-empty targets are rejected unless `--force` is explicit; protected and overlapping paths are
  rejected even with `--force`.
- Generated package/workspace/environment identities are replaced consistently.
- Generated projects remove maintainer-only release scripts and local/build state.
- Playwright signs in through the visible Admin page, opens Settings, Jobs/Outbox, Storage, Payments,
  and Audit, then creates and completes a Mock payment through the UI.
- The CI browser workflow provisions PostgreSQL, migration, bootstrap, API, Worker, Caddy, and
  Chromium from a clean runner.

## Engineering acceptance

- `corepack pnpm check`: passed; 67 automated tests passed and all workspaces built.
- `corepack pnpm smoke:cli-release`: passed.
- `corepack pnpm smoke:module-generator`: passed.
- `corepack pnpm smoke:generated`: passed after independent install and full quality check.
- `corepack pnpm smoke:docker`: passed with production image rebuild and cleanup.
- `corepack pnpm audit --prod --audit-level high`: no known vulnerabilities.
- Playwright browser E2E: 2 passed.

## Delivery status

All nine implementation stages are complete. Remaining work is operational rather than missing
starter functionality: publish the npm package/tag, execute provider-owned sandbox acceptance with
real credentials, and build application-specific business modules on top of the starter.
