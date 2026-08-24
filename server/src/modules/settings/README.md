# Settings module

Owns registered application settings, environment fallbacks, encrypted database overrides and key
rotation. Sensitive values use `@lingcoo-tech/crypto`; API views expose only configured/masked state.
Every database mutation is committed in the same transaction as its business audit event.
