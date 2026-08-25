import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createPaymentIntentRequestSchema,
  createPaymentRefundRequestSchema,
  entityIdSchema,
  paymentIntentQuerySchema,
  paymentRefundQuerySchema,
} from '@ts-business-app-starter/contracts';

import { CurrentPrincipal, Public, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { RequestPrincipal } from '../../../common/auth/auth-context';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { PaymentsService } from '../application/payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('intents')
  @RequirePermissions('payments.read')
  listIntents(@Query(new ZodValidationPipe(paymentIntentQuerySchema)) query: unknown) {
    return this.payments.list(paymentIntentQuerySchema.parse(query));
  }

  @Post('intents')
  @RequirePermissions('payments.manage')
  createIntent(
    @Body(new ZodValidationPipe(createPaymentIntentRequestSchema)) body: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.payments.create(
      createPaymentIntentRequestSchema.parse(body),
      this.context(principal, request),
    );
  }

  @Get('intents/:id')
  @RequirePermissions('payments.read')
  async getIntent(@Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown) {
    return { intent: await this.payments.get(entityIdSchema.parse(id)) };
  }

  @Post('intents/:id/query')
  @RequirePermissions('payments.manage')
  queryIntent(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.payments.query(entityIdSchema.parse(id), this.context(principal, request));
  }

  @Post('intents/:id/close')
  @RequirePermissions('payments.manage')
  closeIntent(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.payments.close(entityIdSchema.parse(id), this.context(principal, request));
  }

  @Post('intents/:id/mock-succeed')
  @RequirePermissions('payments.manage')
  mockSucceed(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.payments.mockSucceed(entityIdSchema.parse(id), this.context(principal, request));
  }

  @Post('intents/:id/refunds')
  @RequirePermissions('payments.manage')
  refund(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @Body(new ZodValidationPipe(createPaymentRefundRequestSchema)) body: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.payments.refund(
      entityIdSchema.parse(id),
      createPaymentRefundRequestSchema.parse(body),
      this.context(principal, request),
    );
  }

  @Get('refunds')
  @RequirePermissions('payments.read')
  listRefunds(@Query(new ZodValidationPipe(paymentRefundQuerySchema)) query: unknown) {
    return this.payments.listRefunds(paymentRefundQuerySchema.parse(query));
  }

  @Post('refunds/:id/query')
  @RequirePermissions('payments.manage')
  queryRefund(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.payments.queryRefund(entityIdSchema.parse(id), this.context(principal, request));
  }

  @Post('callbacks/alipay')
  @Public()
  @RouteConfig({ rawBody: true })
  async alipayCallback(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: FastifyRequest & { rawBody?: string | Buffer },
    @Res() reply: FastifyReply,
  ) {
    await this.payments.callback(
      'alipay',
      { headers, parsedBody: body, rawBody: this.rawBody(request) },
      this.providerContext(request),
    );
    return reply.type('text/plain').send('success');
  }

  @Post('callbacks/wechat')
  @Public()
  @RouteConfig({ rawBody: true })
  async wechatCallback(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: FastifyRequest & { rawBody?: string | Buffer },
    @Res() reply: FastifyReply,
  ) {
    await this.payments.callback(
      'wechat',
      { headers, parsedBody: body, rawBody: this.rawBody(request) },
      this.providerContext(request),
    );
    return reply.send({ code: 'SUCCESS', message: '成功' });
  }

  private context(principal: RequestPrincipal, request: FastifyRequest) {
    return {
      actorType: 'user' as const,
      actorId: principal.userId,
      requestId: request.id,
      ipAddress: request.ip.slice(0, 64),
      userAgent: request.headers['user-agent']?.slice(0, 512) ?? null,
    };
  }

  private providerContext(request: FastifyRequest) {
    return {
      actorType: 'provider' as const,
      requestId: request.id,
      ipAddress: request.ip.slice(0, 64),
      userAgent: request.headers['user-agent']?.slice(0, 512) ?? null,
    };
  }

  private rawBody(request: FastifyRequest & { rawBody?: string | Buffer }) {
    const value = request.rawBody;
    if (value === undefined) throw new Error('Payment callback raw body is unavailable');
    return Buffer.isBuffer(value) ? value.toString('utf8') : value;
  }
}
