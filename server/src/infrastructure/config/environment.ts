import { z } from 'zod';

const DEVELOPMENT_SETTINGS_KEY = 'development-only-settings-key-change-me';

const settingsKeyringSchema = z
  .string()
  .default(JSON.stringify({ development: DEVELOPMENT_SETTINGS_KEY }))
  .transform((value, context): unknown => {
    try {
      return JSON.parse(value);
    } catch {
      context.addIssue({ code: 'custom', message: 'must be a JSON object of key IDs to secrets' });
      return z.NEVER;
    }
  })
  .pipe(z.record(z.string().trim().min(1).max(120), z.string().min(32)));

const optionalEnvironmentValue = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.literal(''), schema])
    .optional()
    .transform((value): z.output<T> | undefined => (value === '' ? undefined : value));

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_NAME: z.string().trim().min(1).default('ts-business-app-starter'),
    APP_VERSION: z.string().trim().min(1).default('development'),
    API_HOST: z.string().trim().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(8090),
    CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174'),
    DATABASE_URL: z.string().url(),
    API_DOCS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(604_800),
    AUTH_ACTION_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(3600),
    AUTH_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default('app_session'),
    AUTH_CSRF_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default('app_csrf'),
    AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    AUTH_COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    AUTH_EXPOSE_TEST_TOKENS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SETTINGS_ENCRYPTION_CURRENT_KEY_ID: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]+$/)
      .max(120)
      .default('development'),
    SETTINGS_ENCRYPTION_KEYS: settingsKeyringSchema,
    SUPPORT_EMAIL: optionalEnvironmentValue(
      z.string().trim().toLowerCase().pipe(z.email().max(320)),
    ),
    SMTP_PASSWORD: optionalEnvironmentValue(z.string().min(1).max(1000)),
    BOOTSTRAP_OWNER_EMAIL: z.string().trim().optional(),
    BOOTSTRAP_OWNER_PASSWORD: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && !value.AUTH_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message: 'must be true in production',
      });
    }
    if (value.NODE_ENV === 'production' && value.AUTH_EXPOSE_TEST_TOKENS) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_EXPOSE_TEST_TOKENS'],
        message: 'must be false in production',
      });
    }
    if (value.AUTH_COOKIE_SAME_SITE === 'none' && !value.AUTH_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SAME_SITE'],
        message: 'none requires secure cookies',
      });
    }
    if (Boolean(value.BOOTSTRAP_OWNER_EMAIL) !== Boolean(value.BOOTSTRAP_OWNER_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['BOOTSTRAP_OWNER_EMAIL'],
        message: 'email and password must be provided together',
      });
    }
    if (!value.SETTINGS_ENCRYPTION_KEYS[value.SETTINGS_ENCRYPTION_CURRENT_KEY_ID]) {
      context.addIssue({
        code: 'custom',
        path: ['SETTINGS_ENCRYPTION_CURRENT_KEY_ID'],
        message: 'must identify a key in SETTINGS_ENCRYPTION_KEYS',
      });
    }
    if (
      value.NODE_ENV === 'production' &&
      Object.values(value.SETTINGS_ENCRYPTION_KEYS).includes(DEVELOPMENT_SETTINGS_KEY)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SETTINGS_ENCRYPTION_KEYS'],
        message: 'must not contain the development key in production',
      });
    }
  });

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function validateEnvironment(values: Record<string, unknown>): AppEnvironment {
  const result = environmentSchema.safeParse(values);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
