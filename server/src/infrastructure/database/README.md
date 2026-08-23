# Database conventions

## Ownership

Drizzle schema files are owned by application modules and live under:

```text
server/src/modules/<module>/infrastructure/persistence/*.schema.ts
```

The Drizzle configuration scans `server/src/**/*.schema.ts`, while ordered SQL migrations remain centralized in `server/drizzle/` as deployment artifacts.

## Rules

- A module writes only the tables it owns.
- Cross-module behavior uses public application services or events, not another module's repository.
- Cross-module foreign keys are allowed only when the lifecycle dependency is explicit and reviewed.
- Store money in integer minor units and include the currency.
- Store instants as timezone-aware PostgreSQL timestamps and expose ISO 8601 values with offsets.
- Use database constraints and unique indexes for invariants that must survive concurrency.
- Add soft deletion, actor columns, and optimistic versions only where their semantics are defined.
- Never use `drizzle-kit push` in production; production changes use committed SQL migrations.
- CI runs migrations twice to verify idempotent deployment behavior.

## Transactions

Application services own transaction boundaries. Repositories accept the database executor supplied by the application layer. Business state changes and required asynchronous events must be written in the same transaction through the Transactional Outbox once that module is available.
