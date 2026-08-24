import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { entityIdSchema, outboxQuerySchema } from '@ts-business-app-starter/contracts';

import { CurrentPrincipal, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { RequestPrincipal } from '../../../common/auth/auth-context';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { OutboxService } from '../application/outbox.service';

@Controller('outbox')
@RequirePermissions('jobs.read')
export class OutboxController {
  constructor(private readonly outbox: OutboxService) {}

  @Get()
  list(@Query(new ZodValidationPipe(outboxQuerySchema)) query: unknown) {
    return this.outbox.list(outboxQuerySchema.parse(query));
  }

  @Get(':id')
  get(@Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown) {
    return this.outbox.get(entityIdSchema.parse(id));
  }

  @Post(':id/retry')
  @RequirePermissions('jobs.manage')
  retry(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.outbox.retry(entityIdSchema.parse(id), {
      actorType: 'user',
      actorId: principal.userId,
      requestId: request.id,
      ipAddress: request.ip.slice(0, 64),
      userAgent: request.headers['user-agent']?.slice(0, 512) ?? null,
    });
  }
}
