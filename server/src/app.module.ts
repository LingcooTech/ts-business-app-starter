import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { FastifyThrottlerGuard } from './common/http/fastify-throttler.guard';
import { AppConfigModule } from './infrastructure/config/app-config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthModule } from './infrastructure/health/health.module';
import { AccessControlModule } from './modules/access-control/public';
import { SettingsModule } from './modules/settings/public';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    HealthModule,
    AccessControlModule,
    SettingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: FastifyThrottlerGuard }],
})
export class AppModule {}
