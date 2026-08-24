# Settings and Audit

`SettingsModule` owns registered application settings. A definition supplies its stable key, group,
labels, Zod schema, optional environment fallback, sensitivity flag and optional connection tester.
Other modules extend the registry through `SettingsRegistry`; callers must not accept arbitrary,
unregistered keys.

Resolution order is:

```text
database override → environment fallback → definition default → unset
```

Sensitive overrides are encrypted with AES-256-GCM through `@lingcoo-tech/crypto`. The database
stores a versioned authenticated-encryption envelope plus a `key_id`; it never stores the plaintext
in `value_json`. API responses contain only `configured` and `maskedValue` for sensitive settings.

## Keyring and rotation

Configure a JSON keyring and identify its current write key:

```dotenv
SETTINGS_ENCRYPTION_CURRENT_KEY_ID=production-v2
SETTINGS_ENCRYPTION_KEYS={"production-v1":"old-secret-at-least-32-characters","production-v2":"current-secret-at-least-32-characters"}
```

Keep the old key in the keyring until `POST /api/settings/actions/rotate-secrets` reports that all old
rows were migrated. Rotation decrypts each old envelope with its recorded key, validates the value,
re-encrypts it with the current key, increments the setting version and writes an audit event in the
same transaction. Remove the old key only after a successful migration and backup.

Production startup rejects the checked-in development key, a missing selected key, malformed JSON,
or secrets shorter than 32 characters.

## Audit trail

`AuditModule` stores explicit business events with actor, action, resource, outcome, request ID, IP,
user agent and recursively redacted metadata. Settings save, clear, connection test and key rotation
record events. The `audit_logs` migration installs a trigger that rejects SQL `UPDATE` and `DELETE`,
so application code and direct database sessions cannot rewrite history.

Admin routes and APIs require `settings.read`, `settings.manage`, and `audit.read` as appropriate.
