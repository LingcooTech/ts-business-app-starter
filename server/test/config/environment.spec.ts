import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../../src/infrastructure/config/environment';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
};

describe('identity environment configuration', () => {
  it('rejects insecure production session cookies', () => {
    expect(() =>
      validateEnvironment({ ...base, NODE_ENV: 'production', AUTH_COOKIE_SECURE: 'false' }),
    ).toThrow('AUTH_COOKIE_SECURE');
  });

  it('rejects production action-token exposure', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_EXPOSE_TEST_TOKENS: 'true',
      }),
    ).toThrow('AUTH_EXPOSE_TEST_TOKENS');
  });

  it('requires bootstrap credentials as a pair', () => {
    expect(() =>
      validateEnvironment({ ...base, BOOTSTRAP_OWNER_EMAIL: 'owner@example.com' }),
    ).toThrow('BOOTSTRAP_OWNER_EMAIL');
  });

  it('allows cross-site cookies only when secure cookies are enabled', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        AUTH_COOKIE_SAME_SITE: 'none',
        AUTH_COOKIE_SECURE: 'false',
      }),
    ).toThrow('AUTH_COOKIE_SAME_SITE');
    expect(
      validateEnvironment({
        ...base,
        AUTH_COOKIE_SAME_SITE: 'none',
        AUTH_COOKIE_SECURE: 'true',
      }).AUTH_COOKIE_SAME_SITE,
    ).toBe('none');
  });

  it('requires the selected settings key and rejects the development key in production', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        SETTINGS_ENCRYPTION_CURRENT_KEY_ID: 'missing',
        SETTINGS_ENCRYPTION_KEYS: JSON.stringify({ current: 'a'.repeat(32) }),
      }),
    ).toThrow('SETTINGS_ENCRYPTION_CURRENT_KEY_ID');
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        AUTH_COOKIE_SECURE: 'true',
      }),
    ).toThrow('SETTINGS_ENCRYPTION_KEYS');
  });

  it('parses a versioned settings keyring', () => {
    expect(
      validateEnvironment({
        ...base,
        SETTINGS_ENCRYPTION_CURRENT_KEY_ID: 'v2',
        SETTINGS_ENCRYPTION_KEYS: JSON.stringify({ v1: 'a'.repeat(32), v2: 'b'.repeat(32) }),
      }).SETTINGS_ENCRYPTION_KEYS,
    ).toEqual({ v1: 'a'.repeat(32), v2: 'b'.repeat(32) });
  });

  it('normalizes empty optional setting fallbacks from Docker Compose', () => {
    const environment = validateEnvironment({ ...base, SUPPORT_EMAIL: '', SMTP_PASSWORD: '' });
    expect(environment.SUPPORT_EMAIL).toBeUndefined();
    expect(environment.SMTP_PASSWORD).toBeUndefined();
  });
});
