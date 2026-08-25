import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { SettingsRegistry } from '../../settings/public';
import { StorageAdapterFactory } from '../infrastructure/adapters/storage-adapter.factory';

@Injectable()
export class StorageConnectionTestRegistrar implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageConnectionTestRegistrar.name);

  constructor(
    private readonly registry: SettingsRegistry,
    private readonly adapters: StorageAdapterFactory,
  ) {}

  onApplicationBootstrap(): void {
    this.registry.attachTest('storage.provider', async () => {
      try {
        await (await this.adapters.current()).test();
        return { ok: true, message: 'Object storage connection succeeded' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Object storage connection test failed: ${message}`);
        return { ok: false, message: `Object storage connection failed: ${message}` };
      }
    });
  }
}
