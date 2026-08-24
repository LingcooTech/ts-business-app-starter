# Audit module

Owns append-only business audit events. Application services record meaningful actions explicitly;
request logging is not treated as an audit trail. Metadata is recursively redacted before storage,
and the database migration rejects updates and deletes from `audit_logs`.
