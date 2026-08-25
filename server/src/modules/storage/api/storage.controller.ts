import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createStorageUploadRequestSchema,
  entityIdSchema,
  storageObjectQuerySchema,
} from '@ts-business-app-starter/contracts';

import { CurrentPrincipal, Public, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { RequestPrincipal } from '../../../common/auth/auth-context';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { StorageService } from '../application/storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('objects')
  @RequirePermissions('storage.read')
  list(@Query(new ZodValidationPipe(storageObjectQuerySchema)) query: unknown) {
    return this.storage.list(storageObjectQuerySchema.parse(query));
  }

  @Get('objects/:id')
  @RequirePermissions('storage.read')
  get(@Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown) {
    return this.storage.get(entityIdSchema.parse(id));
  }

  @Post('uploads')
  @RequirePermissions('storage.manage')
  authorize(
    @Body(new ZodValidationPipe(createStorageUploadRequestSchema)) body: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.storage.authorize(
      createStorageUploadRequestSchema.parse(body),
      this.context(principal, request),
    );
  }

  @Post('uploads/:id/content')
  @RequirePermissions('storage.manage')
  async uploadLocal(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file();
    if (!file) throw new Error('Multipart upload must include one file');
    return this.storage.uploadLocal(
      entityIdSchema.parse(id),
      {
        stream: file.file,
        contentType: file.mimetype,
      },
      this.context(principal, request),
    );
  }

  @Post('uploads/:id/complete')
  @RequirePermissions('storage.manage')
  complete(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.storage.complete(entityIdSchema.parse(id), this.context(principal, request));
  }

  @Get('objects/:id/access')
  @RequirePermissions('storage.read')
  access(@Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown) {
    return this.storage.access(entityIdSchema.parse(id));
  }

  @Get('objects/:id/content')
  @RequirePermissions('storage.read')
  async content(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.sendContent(
      await this.storage.localContent(entityIdSchema.parse(id), false),
      reply,
    );
  }

  @Get('public/:id')
  @Public()
  async publicContent(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.sendContent(await this.storage.localContent(entityIdSchema.parse(id), true), reply);
  }

  @Delete('objects/:id')
  @RequirePermissions('storage.manage')
  delete(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.storage.delete(entityIdSchema.parse(id), this.context(principal, request));
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

  private sendContent(
    content: Awaited<ReturnType<StorageService['localContent']>>,
    reply: FastifyReply,
  ) {
    reply.header('content-type', content.contentType);
    reply.header('content-length', content.sizeBytes);
    reply.header(
      'content-disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(content.filename)}`,
    );
    return content.stream;
  }
}
