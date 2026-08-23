import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CookieSerializeOptions } from '@fastify/cookie';
import {
  changePasswordRequestSchema,
  confirmEmailVerificationSchema,
  confirmPasswordResetSchema,
  loginRequestSchema,
  requestPasswordResetSchema,
} from '@ts-business-app-starter/contracts';

import { Authenticated, CurrentPrincipal, Public } from '../../../common/auth/auth.decorators';
import type { RequestPrincipal } from '../../../common/auth/auth-context';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { IdentityService } from '../application/identity.service';

@Controller('auth')
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.identity.login(
      loginRequestSchema.parse(body),
      request.headers['user-agent']?.slice(0, 512) ?? null,
    );
    this.setCookies(reply, result.sessionToken, result.csrfToken);
    return {
      user: result.user,
      session: { expiresAt: result.expiresAt },
      csrfToken: result.csrfToken,
    };
  }

  @Get('me')
  @Authenticated()
  me(@CurrentPrincipal() principal: RequestPrincipal) {
    return {
      user: principal.user,
      session: { expiresAt: principal.expiresAt },
      csrfToken: principal.csrfToken,
    };
  }

  @Post('logout')
  @Authenticated()
  async logout(
    @CurrentPrincipal() principal: RequestPrincipal,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.identity.logout(principal.sessionId);
    this.clearCookies(reply);
    return { accepted: true } as const;
  }

  @Post('password/change')
  @Authenticated()
  async changePassword(
    @CurrentPrincipal() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(changePasswordRequestSchema)) body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.identity.changePassword(principal.userId, changePasswordRequestSchema.parse(body));
    this.clearCookies(reply);
    return { accepted: true } as const;
  }

  @Post('password-reset/request')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestPasswordReset(@Body(new ZodValidationPipe(requestPasswordResetSchema)) body: unknown) {
    return this.identity.requestPasswordReset(requestPasswordResetSchema.parse(body).email);
  }

  @Post('password-reset/confirm')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(confirmPasswordResetSchema)) body: unknown,
  ) {
    await this.identity.confirmPasswordReset(confirmPasswordResetSchema.parse(body));
    return { accepted: true } as const;
  }

  @Post('email-verification/request')
  @Authenticated()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestEmailVerification(@CurrentPrincipal() principal: RequestPrincipal) {
    return this.identity.requestEmailVerification(principal.userId);
  }

  @Post('email-verification/confirm')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirmEmailVerification(
    @Body(new ZodValidationPipe(confirmEmailVerificationSchema)) body: unknown,
  ) {
    await this.identity.confirmEmailVerification(confirmEmailVerificationSchema.parse(body).token);
    return { accepted: true } as const;
  }

  private cookieOptions(httpOnly: boolean): CookieSerializeOptions {
    return {
      httpOnly,
      sameSite: this.config.getOrThrow<'lax' | 'strict' | 'none'>('AUTH_COOKIE_SAME_SITE'),
      secure: this.config.getOrThrow<boolean>('AUTH_COOKIE_SECURE'),
      path: '/',
      maxAge: this.config.getOrThrow<number>('AUTH_SESSION_TTL_SECONDS'),
    };
  }

  private setCookies(reply: FastifyReply, sessionToken: string, csrfToken: string): void {
    reply.setCookie(
      this.config.getOrThrow<string>('AUTH_COOKIE_NAME'),
      sessionToken,
      this.cookieOptions(true),
    );
    reply.setCookie(
      this.config.getOrThrow<string>('AUTH_CSRF_COOKIE_NAME'),
      csrfToken,
      this.cookieOptions(false),
    );
  }

  private clearCookies(reply: FastifyReply): void {
    reply.clearCookie(this.config.getOrThrow<string>('AUTH_COOKIE_NAME'), this.cookieOptions(true));
    reply.clearCookie(
      this.config.getOrThrow<string>('AUTH_CSRF_COOKIE_NAME'),
      this.cookieOptions(false),
    );
  }
}
