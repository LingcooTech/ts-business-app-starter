import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/public';
import { SettingsModule } from '../settings/public';
import { StorageController } from './api/storage.controller';
import { StorageConnectionTestRegistrar } from './application/storage-connection-test.registrar';
import { StorageService } from './application/storage.service';
import { StorageSettingsService } from './application/storage-settings.service';
import { LocalStorageAdapter } from './infrastructure/adapters/local-storage.adapter';
import { S3StorageAdapter } from './infrastructure/adapters/s3-storage.adapter';
import { StorageAdapterFactory } from './infrastructure/adapters/storage-adapter.factory';
import { StorageRepository } from './infrastructure/persistence/storage.repository';

@Module({
  imports: [AuditModule, SettingsModule],
  controllers: [StorageController],
  providers: [
    StorageRepository,
    StorageSettingsService,
    LocalStorageAdapter,
    S3StorageAdapter,
    StorageAdapterFactory,
    StorageConnectionTestRegistrar,
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
