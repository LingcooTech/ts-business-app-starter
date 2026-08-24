import { BadRequestException, Logger, type ArgumentsHost } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiErrorFilter } from '../../src/common/http/api-error.filter';

function harness() {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
  };
  reply.status.mockReturnValue(reply);
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-filter-1' }) as FastifyRequest,
      getResponse: () => reply as unknown as FastifyReply,
    }),
  } as unknown as ArgumentsHost;
  return { host, reply };
}

afterEach(() => vi.restoreAllMocks());

describe('ApiErrorFilter', () => {
  it('serializes public ApiError instances without losing details', () => {
    const { host, reply } = harness();
    new ApiErrorFilter().catch(
      new ApiError(409, 'VERSION_CONFLICT', 'The resource changed', { version: 2 }),
      host,
    );

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'VERSION_CONFLICT',
        message: 'The resource changed',
        details: { version: 2 },
        requestId: 'req-filter-1',
      },
    });
  });

  it('adapts Nest exceptions produced by framework pipes', () => {
    const { host, reply } = harness();
    new ApiErrorFilter().catch(
      new BadRequestException({
        code: 'FRAMEWORK_VALIDATION',
        message: ['first error', 'second error'],
      }),
      host,
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'FRAMEWORK_VALIDATION',
        message: 'first error; second error',
        requestId: 'req-filter-1',
      },
    });
  });

  it('hides unknown exceptions and records the server error', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, reply } = harness();
    new ApiErrorFilter().catch(new Error('database password leaked here'), host);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId: 'req-filter-1',
      },
    });
  });
});
