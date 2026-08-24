import { Injectable } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';

import { CORE_SETTINGS } from '../domain/core-settings';
import type { SettingDefinition, SettingTestResult } from '../domain/settings.types';

@Injectable()
export class SettingsRegistry {
  private readonly definitions = new Map<string, SettingDefinition>();

  constructor() {
    for (const definition of CORE_SETTINGS) this.register(definition);
  }

  register(definition: SettingDefinition): void {
    if (this.definitions.has(definition.key)) {
      throw new Error(`Setting definition already registered: ${definition.key}`);
    }
    this.definitions.set(definition.key, definition);
  }

  attachTest(key: string, test: (value: unknown) => Promise<SettingTestResult>): void {
    const definition = this.get(key);
    if (definition.test) throw new Error(`Setting test already registered: ${key}`);
    this.definitions.set(key, { ...definition, test });
  }

  list(): SettingDefinition[] {
    return [...this.definitions.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  get(key: string): SettingDefinition {
    const definition = this.definitions.get(key);
    if (!definition) throw new ApiError(404, 'SETTING_NOT_FOUND', 'Setting is not registered');
    return definition;
  }
}
