import { Injectable } from '@nestjs/common';

import type { ObjectStoragePort } from '../../domain/storage.types';
import { StorageSettingsService } from '../../application/storage-settings.service';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';

@Injectable()
export class StorageAdapterFactory {
  constructor(
    private readonly settings: StorageSettingsService,
    private readonly local: LocalStorageAdapter,
    private readonly s3: S3StorageAdapter,
  ) {}

  async current(): Promise<ObjectStoragePort> {
    return this.forProvider(await this.settings.provider());
  }

  forProvider(provider: 'local' | 's3'): ObjectStoragePort {
    return provider === 'local' ? this.local : this.s3;
  }
}
