import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { SettingsRegistry, SettingsService } from '../../settings/public';

const booleanSettingSchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
]);

@Injectable()
export class StorageSettingsService implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly registry: SettingsRegistry,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      key: 'storage.provider',
      group: 'storage',
      label: '对象存储驱动',
      description: 'local 用于本地开发；s3 可连接 AWS S3、R2、MinIO、七牛 Kodo 等兼容端点。',
      schema: z.enum(['local', 's3']),
      environment: 'STORAGE_PROVIDER',
      defaultValue: 'local',
    });
    this.registry.register({
      key: 'storage.s3-region',
      group: 'storage',
      label: 'S3 Region',
      description: 'S3-compatible 服务区域。',
      schema: z.string().trim().min(1).max(120),
      environment: 'STORAGE_S3_REGION',
      defaultValue: 'us-east-1',
    });
    this.registry.register({
      key: 'storage.s3-endpoint',
      group: 'storage',
      label: 'S3 Endpoint',
      description: '兼容服务的 API Endpoint；AWS S3 可留空。',
      schema: z.string().trim().url().max(1000),
      environment: 'STORAGE_S3_ENDPOINT',
    });
    this.registry.register({
      key: 'storage.s3-bucket',
      group: 'storage',
      label: 'S3 Bucket',
      description: '对象所在 Bucket。',
      schema: z.string().trim().min(1).max(255),
      environment: 'STORAGE_S3_BUCKET',
    });
    this.registry.register({
      key: 'storage.s3-access-key',
      group: 'storage',
      label: 'S3 Access Key',
      description: 'S3-compatible 身份凭据；运行环境使用实例角色时可留空。',
      schema: z.string().min(1).max(1000),
      sensitive: true,
      environment: 'STORAGE_S3_ACCESS_KEY',
    });
    this.registry.register({
      key: 'storage.s3-secret-key',
      group: 'storage',
      label: 'S3 Secret Key',
      description: 'S3-compatible Secret；保存后仅显示脱敏状态。',
      schema: z.string().min(1).max(2000),
      sensitive: true,
      environment: 'STORAGE_S3_SECRET_KEY',
    });
    this.registry.register({
      key: 'storage.s3-force-path-style',
      group: 'storage',
      label: '强制 Path-style',
      description: 'MinIO 等兼容服务通常需要开启。',
      schema: booleanSettingSchema,
      environment: 'STORAGE_S3_FORCE_PATH_STYLE',
      defaultValue: false,
    });
    this.registry.register({
      key: 'storage.public-base-url',
      group: 'storage',
      label: '公共访问根地址',
      description: '公共 Bucket 或 CDN 根地址；未设置时 S3 公共对象也返回临时签名 URL。',
      schema: z.string().trim().url().max(1000),
      environment: 'STORAGE_PUBLIC_BASE_URL',
    });
  }

  async provider(): Promise<'local' | 's3'> {
    return (await this.settings.getValue<'local' | 's3'>('storage.provider')) ?? 'local';
  }

  localRoot(): string {
    return this.config.getOrThrow<string>('STORAGE_LOCAL_ROOT');
  }

  maxUploadBytes(): number {
    return this.config.getOrThrow<number>('STORAGE_MAX_UPLOAD_BYTES');
  }

  uploadExpirySeconds(): number {
    return this.config.getOrThrow<number>('STORAGE_UPLOAD_EXPIRY_SECONDS');
  }

  accessExpirySeconds(): number {
    return this.config.getOrThrow<number>('STORAGE_ACCESS_EXPIRY_SECONDS');
  }

  allowedMimeTypes(): string[] {
    return this.csv(this.config.getOrThrow<string>('STORAGE_ALLOWED_MIME_TYPES'));
  }

  allowedPrefixes(): string[] {
    return this.csv(this.config.getOrThrow<string>('STORAGE_ALLOWED_PREFIXES'));
  }

  async s3Config() {
    const [region, endpoint, bucket, accessKeyId, secretAccessKey, forcePathStyle, publicBaseUrl] =
      await Promise.all([
        this.settings.getValue<string>('storage.s3-region'),
        this.settings.getValue<string>('storage.s3-endpoint'),
        this.settings.getValue<string>('storage.s3-bucket'),
        this.settings.getValue<string>('storage.s3-access-key'),
        this.settings.getValue<string>('storage.s3-secret-key'),
        this.settings.getValue<boolean>('storage.s3-force-path-style'),
        this.settings.getValue<string>('storage.public-base-url'),
      ]);
    if (!region || !bucket) throw new Error('S3 region and bucket must be configured');
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
      throw new Error('S3 access key and secret key must be configured together');
    }
    return {
      region,
      endpoint,
      bucket,
      forcePathStyle: forcePathStyle ?? false,
      publicBaseUrl,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    };
  }

  private csv(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
}
