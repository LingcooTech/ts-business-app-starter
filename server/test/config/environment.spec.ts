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
});
