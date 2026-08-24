import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import {
  entityIdSchema,
  mailDeliveryQuerySchema,
  sendTestMailRequestSchema,
} from '@ts-business-app-starter/contracts';

import { CurrentPrincipal, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { RequestPrincipal } from '../../../common/auth/auth-context';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { MailService } from '../application/mail.service';

@Controller('mail')
@RequirePermissions('integrations.manage')
export class MailController {
  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Get('deliveries')
  list(@Query(new ZodValidationPipe(mailDeliveryQuerySchema)) query: unknown) {
    return this.mail.list(mailDeliveryQuerySchema.parse(query));
  }

  @Get('deliveries/:id')
  get(@Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown) {
    return this.mail.get(entityIdSchema.parse(id));
  }

  @Post('test')
  queueTest(
    @Body(new ZodValidationPipe(sendTestMailRequestSchema)) body: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.mail.queueTest(
      sendTestMailRequestSchema.parse(body),
      this.config.getOrThrow<string>('APP_NAME'),
      {
        actorType: 'user',
        actorId: principal.userId,
        requestId: request.id,
        ipAddress: request.ip.slice(0, 64),
        userAgent: request.headers['user-agent']?.slice(0, 512) ?? null,
      },
    );
  }
}
