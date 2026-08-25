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
    PUBLIC_WEB_URL: z.string().url().default('http://localhost:5174'),
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
    MAIL_TRANSPORT: z.enum(['log', 'smtp']).default('log'),
    SMTP_HOST: optionalEnvironmentValue(z.string().trim().min(1).max(255)),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: optionalEnvironmentValue(z.string().trim().min(1).max(320)),
    SMTP_PASSWORD: optionalEnvironmentValue(z.string().min(1).max(1000)),
    SMTP_FROM: optionalEnvironmentValue(z.string().trim().min(1).max(320)),
    JOB_WORKER_ID: optionalEnvironmentValue(z.string().trim().min(1).max(200)),
    JOB_POLL_INTERVAL_MS: z.coerce.number().int().min(25).max(60_000).default(500),
    JOB_BATCH_SIZE: z.coerce.number().int().min(1).max(1_000).default(20),
    JOB_LOCK_TIMEOUT_SECONDS: z.coerce.number().int().min(10).max(86_400).default(60),
    JOB_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1_000).max(30_000).default(10_000),
    JOB_BACKOFF_BASE_MS: z.coerce.number().int().min(50).max(86_400_000).default(1_000),
    JOB_BACKOFF_MAX_MS: z.coerce.number().int().min(100).max(604_800_000).default(300_000),
    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().trim().min(1).default('.data/storage'),
    STORAGE_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(5_000_000_000)
      .default(25_000_000),
    STORAGE_UPLOAD_EXPIRY_SECONDS: z.coerce.number().int().min(30).max(3_600).default(900),
    STORAGE_ACCESS_EXPIRY_SECONDS: z.coerce.number().int().min(30).max(86_400).default(900),
    STORAGE_ALLOWED_MIME_TYPES: z.string().default('image/*,application/pdf,text/plain'),
    STORAGE_ALLOWED_PREFIXES: z.string().default('media,documents,avatars'),
    STORAGE_S3_REGION: z.string().trim().min(1).default('us-east-1'),
    STORAGE_S3_ENDPOINT: optionalEnvironmentValue(z.string().trim().url().max(1000)),
    STORAGE_S3_BUCKET: optionalEnvironmentValue(z.string().trim().min(1).max(255)),
    STORAGE_S3_ACCESS_KEY: optionalEnvironmentValue(z.string().min(1).max(1000)),
    STORAGE_S3_SECRET_KEY: optionalEnvironmentValue(z.string().min(1).max(2000)),
    STORAGE_S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    STORAGE_PUBLIC_BASE_URL: optionalEnvironmentValue(z.string().trim().url().max(1000)),
    PAYMENT_PROVIDER: z.enum(['mock', 'alipay', 'wechat']).default('mock'),
    PAYMENT_NOTIFY_BASE_URL: z.string().trim().url().default('http://localhost:8090'),
    PAYMENT_CALLBACK_TOLERANCE_SECONDS: z.coerce.number().int().min(60).max(3_600).default(300),
    PAYMENT_ALIPAY_APP_ID: optionalEnvironmentValue(z.string().trim().min(1).max(64)),
    PAYMENT_ALIPAY_PRIVATE_KEY: optionalEnvironmentValue(z.string().min(100).max(20_000)),
    PAYMENT_ALIPAY_PUBLIC_KEY: optionalEnvironmentValue(z.string().min(100).max(20_000)),
    PAYMENT_ALIPAY_GATEWAY: z
      .string()
      .trim()
      .url()
      .default('https://openapi.alipay.com/gateway.do'),
    PAYMENT_ALIPAY_RETURN_URL: optionalEnvironmentValue(z.string().trim().url().max(1000)),
    PAYMENT_WECHAT_MCH_ID: optionalEnvironmentValue(z.string().trim().min(1).max(64)),
    PAYMENT_WECHAT_APP_ID: optionalEnvironmentValue(z.string().trim().min(1).max(64)),
    PAYMENT_WECHAT_MERCHANT_SERIAL: optionalEnvironmentValue(z.string().trim().min(1).max(128)),
    PAYMENT_WECHAT_PRIVATE_KEY: optionalEnvironmentValue(z.string().min(100).max(20_000)),
    PAYMENT_WECHAT_PLATFORM_CERTIFICATES: optionalEnvironmentValue(z.string().min(2).max(100_000)),
    PAYMENT_WECHAT_API_V3_KEY: optionalEnvironmentValue(z.string().length(32)),
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
    if (value.JOB_HEARTBEAT_INTERVAL_MS >= value.JOB_LOCK_TIMEOUT_SECONDS * 1_000) {
      context.addIssue({
        code: 'custom',
        path: ['JOB_HEARTBEAT_INTERVAL_MS'],
        message: 'must be less than JOB_LOCK_TIMEOUT_SECONDS',
      });
    }
    if (value.JOB_BACKOFF_BASE_MS > value.JOB_BACKOFF_MAX_MS) {
      context.addIssue({
        code: 'custom',
        path: ['JOB_BACKOFF_BASE_MS'],
        message: 'must not exceed JOB_BACKOFF_MAX_MS',
      });
    }
    if (value.STORAGE_PROVIDER === 's3' && !value.STORAGE_S3_BUCKET) {
      context.addIssue({
        code: 'custom',
        path: ['STORAGE_S3_BUCKET'],
        message: 'must be configured when STORAGE_PROVIDER is s3',
      });
    }
    if (Boolean(value.STORAGE_S3_ACCESS_KEY) !== Boolean(value.STORAGE_S3_SECRET_KEY)) {
      context.addIssue({
        code: 'custom',
        path: ['STORAGE_S3_ACCESS_KEY'],
        message: 'access key and secret key must be provided together',
      });
    }
    if (value.PAYMENT_PROVIDER === 'alipay') {
      for (const key of [
        'PAYMENT_ALIPAY_APP_ID',
        'PAYMENT_ALIPAY_PRIVATE_KEY',
        'PAYMENT_ALIPAY_PUBLIC_KEY',
      ] as const) {
        if (!value[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'must be configured when PAYMENT_PROVIDER is alipay',
          });
        }
      }
    }
    if (value.PAYMENT_PROVIDER === 'wechat') {
      for (const key of [
        'PAYMENT_WECHAT_MCH_ID',
        'PAYMENT_WECHAT_APP_ID',
        'PAYMENT_WECHAT_MERCHANT_SERIAL',
        'PAYMENT_WECHAT_PRIVATE_KEY',
        'PAYMENT_WECHAT_PLATFORM_CERTIFICATES',
        'PAYMENT_WECHAT_API_V3_KEY',
      ] as const) {
        if (!value[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'must be configured when PAYMENT_PROVIDER is wechat',
          });
        }
      }
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
