import type { SettingSource } from '@ts-business-app-starter/contracts';
import type { ZodType } from 'zod';

export type SettingTestResult = { ok: boolean; message: string };

export type SettingDefinition<T = unknown> = {
  key: string;
  group: string;
  label: string;
  description: string;
  schema: ZodType<T>;
  sensitive?: boolean;
  environment?: string;
  defaultValue?: T;
  test?: (value: T) => Promise<SettingTestResult>;
};

export type ResolvedSetting<T = unknown> = {
  definition: SettingDefinition<T>;
  value?: T;
  source: SettingSource;
  version: number | null;
  updatedAt: Date | null;
  updatedBy: string | null;
};
