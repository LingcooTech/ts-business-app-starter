import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/public';
import { SettingsController } from './api/settings.controller';
import { SettingsRegistry } from './application/settings.registry';
import { SettingsService } from './application/settings.service';
import { SettingsCipher } from './infrastructure/settings-cipher';
import { SettingsRepository } from './infrastructure/persistence/settings.repository';

@Module({
  imports: [AuditModule],
  controllers: [SettingsController],
  providers: [SettingsRegistry, SettingsCipher, SettingsRepository, SettingsService],
  exports: [SettingsRegistry, SettingsService],
})
export class SettingsModule {}
