import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  apiErrorResponseSchema,
  auditListResponseSchema,
  sessionIdentitySchema,
  createPaginatedResponseSchema,
  createSortQuerySchema,
  isoDateTimeSchema,
  notificationQuerySchema,
  paginationMeta,
  paginationQuerySchema,
  permissionKeySchema,
  settingViewSchema,
} from './index.js';

describe('shared API contracts', () => {
  it('normalizes pagination query parameters from HTTP strings', () => {
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '50', search: '  demo  ' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'demo',
    });
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });

  it('keeps notification boolean queries stable across HTTP and parsed controller values', () => {
    expect(notificationQuerySchema.parse({ unreadOnly: 'true' })).toMatchObject({
      unreadOnly: true,
      includeArchived: false,
    });
    expect(
      notificationQuerySchema.parse({ unreadOnly: true, includeArchived: false }),
    ).toMatchObject({ unreadOnly: true, includeArchived: false });
  });

  it('builds stable pagination metadata, including the empty case', () => {
    expect(paginationMeta({ page: 1, pageSize: 20, total: 0 })).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    expect(paginationMeta({ page: 2, pageSize: 20, total: 41 }).totalPages).toBe(3);
  });

  it('validates module-specific sort fields', () => {
    const schema = createSortQuerySchema(['createdAt', 'name'] as const);
    expect(schema.parse({ sortBy: 'name' })).toEqual({ sortBy: 'name', sortDirection: 'asc' });
    expect(() => schema.parse({ sortBy: 'unknown' })).toThrow();
  });

  it('validates error and paginated response envelopes', () => {
    expect(
      apiErrorResponseSchema.parse({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          requestId: 'req-1',
        },
      }),
    ).toEqual({
      error: { code: 'NOT_FOUND', message: 'Resource not found', requestId: 'req-1' },
    });
    expect(() =>
      apiErrorResponseSchema.parse({
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      }),
    ).toThrow();
    expect(() =>
      apiErrorResponseSchema.parse({
        error: { code: 404, message: 'Resource not found', requestId: 'req-1' },
      }),
    ).toThrow();
    expect(() =>
      apiErrorResponseSchema.parse({
        error: { code: '', message: 'Resource not found', requestId: 'req-1' },
      }),
    ).toThrow();

    const responseSchema = createPaginatedResponseSchema(z.object({ id: z.uuid() }));
    expect(
      responseSchema.parse({
        items: [{ id: 'fdda765f-fc57-5604-a269-52a7df8164ec' }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }).items,
    ).toHaveLength(1);
  });

  it('requires timezone-aware ISO date-time values', () => {
    expect(isoDateTimeSchema.parse('2026-08-23T15:30:00+08:00')).toBe('2026-08-23T15:30:00+08:00');
    expect(() => isoDateTimeSchema.parse('2026-08-23T15:30:00')).toThrow();
  });

  it('validates the authenticated identity response without exposing credentials', () => {
    const identity = sessionIdentitySchema.parse({
      user: {
        id: 'fdda765f-fc57-5604-a269-52a7df8164ec',
        email: 'OWNER@EXAMPLE.COM',
        displayName: null,
        status: 'active',
        emailVerifiedAt: '2026-08-23T15:30:00+08:00',
        createdAt: '2026-08-23T15:00:00+08:00',
      },
      session: { expiresAt: '2026-08-30T15:30:00+08:00' },
      csrfToken: 'csrf-token-with-at-least-thirty-two-characters',
    });

    expect(identity.user.email).toBe('owner@example.com');
    expect(identity).not.toHaveProperty('passwordHash');
  });

  it('accepts namespaced permission keys and rejects role names', () => {
    expect(permissionKeySchema.parse('accounts.read')).toBe('accounts.read');
    expect(() => permissionKeySchema.parse('admin')).toThrow();
  });

  it('keeps sensitive setting views masked and validates audit pagination', () => {
    expect(
      settingViewSchema.parse({
        key: 'integrations.smtp-password',
        group: 'integrations',
        label: 'SMTP password',
        description: 'Encrypted credential',
        sensitive: true,
        testable: false,
        source: 'database',
        configured: true,
        maskedValue: '••••••••',
        version: 2,
        updatedAt: '2026-08-24T10:00:00Z',
        updatedBy: 'fdda765f-fc57-5604-a269-52a7df8164ec',
      }).maskedValue,
    ).toBe('••••••••');
    expect(() =>
      settingViewSchema.parse({
        key: 'integrations.smtp-password',
        group: 'integrations',
        label: 'SMTP password',
        description: 'Encrypted credential',
        sensitive: true,
        testable: false,
        source: 'database',
        configured: true,
        value: 'must-never-be-accepted',
        version: 2,
        updatedAt: '2026-08-24T10:00:00Z',
        updatedBy: 'fdda765f-fc57-5604-a269-52a7df8164ec',
      }),
    ).toThrow();

    expect(
      auditListResponseSchema.parse({
        items: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      }).items,
    ).toEqual([]);
  });
});
