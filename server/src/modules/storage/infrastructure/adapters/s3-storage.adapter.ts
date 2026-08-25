import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

import type { ObjectStoragePort } from '../../domain/storage.types';
import { StorageSettingsService } from '../../application/storage-settings.service';

@Injectable()
export class S3StorageAdapter implements ObjectStoragePort {
  constructor(private readonly settings: StorageSettingsService) {}

  provider() {
    return 's3' as const;
  }

  async bucket(): Promise<string> {
    return (await this.settings.s3Config()).bucket;
  }

  async authorizeUpload(input: { key: string; contentType: string; expiresInSeconds: number }) {
    const config = await this.settings.s3Config();
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      ContentType: input.contentType,
    });
    return {
      method: 'PUT' as const,
      url: await getSignedUrl(this.client(config), command, { expiresIn: input.expiresInSeconds }),
      headers: { 'content-type': input.contentType },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
    };
  }

  async head(key: string, bucket: string) {
    const config = await this.settings.s3Config();
    try {
      const result = await this.client(config).send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return {
        sizeBytes: result.ContentLength ?? 0,
        contentType: result.ContentType ?? 'application/octet-stream',
        etag: result.ETag?.replaceAll('"', '') ?? null,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }

  async accessUrl(input: {
    bucket: string;
    key: string;
    visibility: 'public' | 'private';
    expiresInSeconds: number;
  }) {
    const config = await this.settings.s3Config();
    if (input.visibility === 'public' && config.publicBaseUrl) {
      return {
        url: `${config.publicBaseUrl.replace(/\/$/, '')}/${input.key
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
        expiresAt: null,
      };
    }
    return {
      url: await getSignedUrl(
        this.client(config),
        new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
        { expiresIn: input.expiresInSeconds },
      ),
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
    };
  }

  async delete(key: string, bucket: string): Promise<void> {
    const config = await this.settings.s3Config();
    await this.client(config).send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async test(): Promise<void> {
    const config = await this.settings.s3Config();
    await this.client(config).send(new HeadBucketCommand({ Bucket: config.bucket }));
  }

  private client(config: Awaited<ReturnType<StorageSettingsService['s3Config']>>): S3Client {
    return new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credentials,
    });
  }
}
