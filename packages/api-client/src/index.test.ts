import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@lingcoo-tech/http';

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
    const error = await new ApiClient({ fetch: fetcher })
      .login({ email: 'a@b.com', password: 'x' })
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toEqual(
      expect.objectContaining({
        code: 'INVALID_CREDENTIALS',
        requestId: 'req-2',
        statusCode: 401,
      }),
    );
  });

  it('rejects error envelopes that omit the application request ID', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Missing trace context',
          },
        },
        401,
      ),
    );
    await expect(
      new ApiClient({ fetch: fetcher }).login({ email: 'a@b.com', password: 'x' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'HTTP_ERROR', statusCode: 401 }));
  });

  it('uploads local storage files with the authenticated multipart flow', async () => {
    const object = {
      id: '9f2148c5-7ddb-4b17-85f7-700eab5ba697',
      provider: 'local',
      bucket: 'local',
      key: 'media/2026/08/object.txt',
      originalName: 'object.txt',
      contentType: 'text/plain',
      sizeBytes: 5,
      visibility: 'private',
      status: 'ready',
      etag: 'etag',
      createdBy: identity.user.id,
      uploadedAt: '2026-08-25T01:00:00Z',
      deletedAt: null,
      createdAt: '2026-08-25T01:00:00Z',
      updatedAt: '2026-08-25T01:00:00Z',
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(identity))
      .mockResolvedValueOnce(
        response({
          object: { ...object, status: 'pending', uploadedAt: null, etag: null },
          upload: {
            method: 'POST',
            url: '/api/storage/uploads/9f2148c5-7ddb-4b17-85f7-700eab5ba697/content',
            headers: { accept: 'application/json' },
            expiresAt: '2026-08-25T01:15:00Z',
          },
        }),
      )
      .mockResolvedValueOnce(response({ object }));
    const client = new ApiClient({ fetch: fetcher });
    await client.login({ email: 'owner@example.com', password: 'password' });
    const uploaded = await client.uploadStorageObject(
      new File(['hello'], 'object.txt', { type: 'text/plain' }),
      { prefix: 'media', visibility: 'private' },
    );

    expect(uploaded.status).toBe('ready');
    const uploadRequest = fetcher.mock.calls[2]?.[1];
    expect(uploadRequest?.body).toBeInstanceOf(FormData);
    expect(new Headers(uploadRequest?.headers).get('x-csrf-token')).toBe(identity.csrfToken);
  });

  it('creates and operates provider-neutral payment intents with CSRF protection', async () => {
    const intent = {
      id: '9f2148c5-7ddb-4b17-85f7-700eab5ba697',
      provider: 'mock',
      merchantOrderId: 'order-20260825-1',
      providerTransactionId: null,
      subject: '服务费',
      description: null,
      amountMinor: 12_800,
      refundedAmountMinor: 0,
      currency: 'CNY',
      status: 'pending',
      checkoutUrl: '/admin/payments?intent=1',
      metadata: {},
      expiresAt: '2026-08-25T02:00:00Z',
      paidAt: null,
      closedAt: null,
      createdBy: identity.user.id,
      lastError: null,
      createdAt: '2026-08-25T01:00:00Z',
      updatedAt: '2026-08-25T01:00:00Z',
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(identity))
      .mockResolvedValueOnce(response({ intent }))
      .mockResolvedValueOnce(response({ intent: { ...intent, status: 'succeeded' } }));
    const client = new ApiClient({ fetch: fetcher });
    await client.login({ email: 'owner@example.com', password: 'password' });
    await client.createPaymentIntent({
      merchantOrderId: intent.merchantOrderId,
      subject: intent.subject,
      amountMinor: intent.amountMinor,
      provider: 'mock',
      currency: 'CNY',
      expiresInSeconds: 1_800,
      metadata: {},
    });
    const succeeded = await client.mockSucceedPaymentIntent(intent.id);

    expect(succeeded.status).toBe('succeeded');
    expect(fetcher.mock.calls[1]?.[0]).toBe('/api/payments/intents');
    expect(fetcher.mock.calls[2]?.[0]).toBe(`/api/payments/intents/${intent.id}/mock-succeed`);
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get('x-csrf-token')).toBe(
      identity.csrfToken,
    );
  });

  it('validates refund input before sending payment requests', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new ApiClient({ fetch: fetcher });
    await expect(
      client.createPaymentRefund('9f2148c5-7ddb-4b17-85f7-700eab5ba697', {
        merchantRefundId: '../invalid',
        amountMinor: 100,
      }),
    ).rejects.toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
