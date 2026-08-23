import { describe, expect, it, vi } from 'vitest';

import { ApiClient } from './index.js';

const identity = {
  user: {
    id: 'fdda765f-fc57-5604-a269-52a7df8164ec',
    email: 'owner@example.com',
    displayName: 'Owner',
    status: 'active',
    emailVerifiedAt: null,
    createdAt: '2026-08-23T07:00:00Z',
  },
  session: { expiresAt: '2026-08-30T07:00:00Z' },
  csrfToken: 'csrf-token-with-at-least-thirty-two-characters',
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ApiClient', () => {
  it('stores the session CSRF token and sends it on mutations', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(identity))
      .mockResolvedValueOnce(response({ accepted: true }));
    const client = new ApiClient({ fetch: fetcher });
    await client.login({ email: 'owner@example.com', password: 'password' });
    await client.logout();

    const secondRequest = fetcher.mock.calls[1]?.[1];
    expect(new Headers(secondRequest?.headers).get('x-csrf-token')).toBe(identity.csrfToken);
    expect(secondRequest?.credentials).toBe('include');
  });

  it('treats an unauthorized session lookup as signed out', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: 'req-1',
          },
        },
        401,
      ),
    );
    await expect(new ApiClient({ fetch: fetcher }).getSession()).resolves.toBeNull();
  });

  it('surfaces the shared API error envelope', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '邮箱或密码错误',
            requestId: 'req-2',
          },
        },
        401,
      ),
    );
    await expect(
      new ApiClient({ fetch: fetcher }).login({ email: 'a@b.com', password: 'x' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'INVALID_CREDENTIALS', requestId: 'req-2' }));
  });
});
