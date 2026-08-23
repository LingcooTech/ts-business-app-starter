# Access Control module

Owns application roles, permissions, assignments, the default-deny HTTP guard, and CSRF enforcement. It defines only generic application permissions and a protected system Owner role; generated applications add their own roles and permissions without changing Identity.

Run `pnpm db:bootstrap` after migrations to synchronize permissions and optionally create the initial Owner from environment variables. The command is idempotent and never overwrites an existing password.
