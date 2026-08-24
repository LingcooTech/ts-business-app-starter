import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  clearSettingRequestSchema,
  saveSettingRequestSchema,
  settingKeySchema,
} from '@ts-business-app-starter/contracts';

import { CurrentPrincipal, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { RequestPrincipal } from '../../../common/auth/auth-context';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import type { AuditContext } from '../../audit/public';
import { SettingsService } from '../application/settings.service';

@Controller('settings')
@RequirePermissions('settings.read')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @Put(':key')
  @RequirePermissions('settings.manage')
  save(
    @Param('key', new ZodValidationPipe(settingKeySchema)) key: unknown,
    @Body(new ZodValidationPipe(saveSettingRequestSchema)) body: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.settings.save(
      settingKeySchema.parse(key),
      saveSettingRequestSchema.parse(body),
      this.context(principal, request),
    );
  }

  @Delete(':key')
  @RequirePermissions('settings.manage')
  clear(
    @Param('key', new ZodValidationPipe(settingKeySchema)) key: unknown,
    @Body(new ZodValidationPipe(clearSettingRequestSchema)) body: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.settings.clear(
      settingKeySchema.parse(key),
      clearSettingRequestSchema.parse(body),
      this.context(principal, request),
    );
  }

  @Post(':key/test')
  @RequirePermissions('settings.manage')
  test(
    @Param('key', new ZodValidationPipe(settingKeySchema)) key: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.settings.test(settingKeySchema.parse(key), this.context(principal, request));
  }

  @Post('actions/rotate-secrets')
  @RequirePermissions('settings.manage')
  rotate(@CurrentPrincipal() principal: RequestPrincipal, @Req() request: FastifyRequest) {
    return this.settings.rotateSecrets(this.context(principal, request));
  }

  private context(
    principal: RequestPrincipal,
    request: FastifyRequest,
  ): AuditContext & { actorId: string } {
    return {
      actorType: 'user',
      actorId: principal.userId,
      requestId: request.id,
      ipAddress: request.ip.slice(0, 64),
      userAgent: request.headers['user-agent']?.slice(0, 512) ?? null,
    };
  }
}
