import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppConfigModule } from './infrastructure/config/app-config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AccessControlModule, BootstrapService } from './modules/access-control/public';

@Module({ imports: [AppConfigModule, DatabaseModule, AccessControlModule] })
class BootstrapModule {}

async function run(): Promise<void> {
  const application = await NestFactory.createApplicationContext(BootstrapModule);
  try {
    await application.get(BootstrapService).run();
  } finally {
    await application.close();
  }
}

void run();
