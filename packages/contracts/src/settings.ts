import { z } from 'zod';

import { isoDateTimeSchema } from './common.js';

export const settingKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/)
  .max(120);

export const settingSourceSchema = z.enum(['database', 'environment', 'default', 'unset']);

const settingViewBaseSchema = z.object({
  key: settingKeySchema,
  group: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  testable: z.boolean(),
  source: settingSourceSchema,
  configured: z.boolean(),
  version: z.number().int().positive().nullable(),
  updatedAt: isoDateTimeSchema.nullable(),
  updatedBy: z.uuid().nullable(),
});

export const settingViewSchema = z.discriminatedUnion('sensitive', [
  settingViewBaseSchema.extend({
    sensitive: z.literal(true),
    value: z.never().optional(),
    maskedValue: z.string().optional(),
  }),
  settingViewBaseSchema.extend({
    sensitive: z.literal(false),
    value: z.unknown().optional(),
    maskedValue: z.never().optional(),
  }),
]);

export const settingsListResponseSchema = z.object({ items: z.array(settingViewSchema) });

export const saveSettingRequestSchema = z.object({
  value: z.unknown(),
  expectedVersion: z.number().int().positive().optional(),
});

export const clearSettingRequestSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
});

export const settingTestResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().trim().min(1).max(500),
});

export const rotateSettingsResponseSchema = z.object({
  rotated: z.number().int().min(0),
});

export type SettingKey = z.infer<typeof settingKeySchema>;
export type SettingSource = z.infer<typeof settingSourceSchema>;
export type SettingView = z.infer<typeof settingViewSchema>;
export type SaveSettingRequest = z.infer<typeof saveSettingRequestSchema>;
export type ClearSettingRequest = z.infer<typeof clearSettingRequestSchema>;
export type SettingTestResponse = z.infer<typeof settingTestResponseSchema>;
