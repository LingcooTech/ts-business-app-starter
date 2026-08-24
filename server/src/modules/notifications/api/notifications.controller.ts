import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  createAnnouncementRequestSchema,
  entityIdSchema,
  notificationQuerySchema,
  type NotificationQuery,
} from '@ts-business-app-starter/contracts';

import {
  Authenticated,
  CurrentPrincipal,
  RequirePermissions,
} from '../../../common/auth/auth.decorators';
import type { RequestPrincipal } from '../../../common/auth/auth-context';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { NotificationsService } from '../application/notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Authenticated()
  list(
    @CurrentPrincipal() principal: RequestPrincipal,
    @Query(new ZodValidationPipe(notificationQuerySchema)) query: NotificationQuery,
  ) {
    return this.notifications.list(principal.userId, query);
  }

  @Get('unread-count')
  @Authenticated()
  unreadCount(@CurrentPrincipal() principal: RequestPrincipal) {
    return this.notifications.unreadCount(principal.userId);
  }

  @Post(':id/read')
  @Authenticated()
  markRead(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
  ) {
    return this.notifications.markRead(entityIdSchema.parse(id), principal.userId);
  }

  @Post(':id/archive')
  @Authenticated()
  archive(
    @Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
  ) {
    return this.notifications.archive(entityIdSchema.parse(id), principal.userId);
  }

  @Post('announcements')
  @RequirePermissions('notifications.manage')
  announce(
    @Body(new ZodValidationPipe(createAnnouncementRequestSchema)) body: unknown,
    @CurrentPrincipal() principal: RequestPrincipal,
    @Req() request: FastifyRequest,
  ) {
    return this.notifications.announce(createAnnouncementRequestSchema.parse(body), {
      actorType: 'user',
      actorId: principal.userId,
      requestId: request.id,
      ipAddress: request.ip.slice(0, 64),
      userAgent: request.headers['user-agent']?.slice(0, 512) ?? null,
    });
  }
}
