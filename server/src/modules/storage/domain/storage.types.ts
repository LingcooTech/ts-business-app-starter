import type { Readable } from 'node:stream';

import type { StorageProvider, StorageVisibility } from '@ts-business-app-starter/contracts';

export const OBJECT_STORAGE_PORT = Symbol('OBJECT_STORAGE_PORT');

export type StorageWriteResult = {
  sizeBytes: number;
  contentType: string;
  etag: string | null;
};

export type UploadAuthorization = {
  method: 'POST' | 'PUT';
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
};

export interface ObjectStoragePort {
  provider(): StorageProvider;
  bucket(): Promise<string>;
  authorizeUpload(input: {
    objectId: string;
    key: string;
    contentType: string;
    sizeBytes: number;
    visibility: StorageVisibility;
    expiresInSeconds: number;
  }): Promise<UploadAuthorization>;
  writeLocal?(key: string, stream: Readable): Promise<StorageWriteResult>;
  head(key: string, bucket: string): Promise<StorageWriteResult | null>;
  read?(key: string): Promise<{ stream: Readable; contentType: string; sizeBytes: number }>;
  accessUrl(input: {
    objectId: string;
    bucket: string;
    key: string;
    visibility: StorageVisibility;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: Date | null }>;
  delete(key: string, bucket: string): Promise<void>;
  test(): Promise<void>;
}
