# Identity module

Owns accounts, password credentials, server-side sessions, password reset tokens, and email verification tokens. Raw session and action tokens are never stored in PostgreSQL; only SHA-256 digests are persisted.

The module does not own roles or permissions. Those belong to `access-control` and consume only this module's `public.ts` entry point.
