import { extname } from 'node:path';
import type { Readable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';
import {
  paginationMeta,
  type CreateStorageUploadRequest,
  type StorageObjectQuery,
} from '@ts-business-app-starter/contracts';

import { AuditService, type AuditContext } from '../../audit/public';
import { StorageAdapterFactory } from '../infrastructure/adapters/storage-adapter.factory';
import { StorageRepository } from '../infrastructure/persistence/storage.repository';
import { StorageSettingsService } from './storage-settings.service';

@Injectable()
export class StorageService {
  constructor(
    private readonly repository: StorageRepository,
    private readonly adapters: StorageAdapterFactory,
    private readonly settings: StorageSettingsService,
    private readonly audit: AuditService,
  ) {}

  async authorize(input: CreateStorageUploadRequest, context: AuditContext & { actorId: string }) {
    this.validateUpload(input);
    const adapter = await this.adapters.current();
    const object = await this.repository.create({
      provider: adapter.provider(),
      bucket: await adapter.bucket(),
      key: this.objectKey(input.prefix, input.filename),
      originalName: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      visibility: input.visibility,
      createdBy: context.actorId,
    });
    const upload = await adapter.authorizeUpload({
      objectId: object.id,
      key: object.key,
      contentType: object.contentType,
      sizeBytes: object.sizeBytes,
      visibility: object.visibility as 'public' | 'private',
      expiresInSeconds: this.settings.uploadExpirySeconds(),
    });
    await this.audit.record({
      ...context,
      action: 'storage.upload_authorized',
      resourceType: 'storage_object',
      resourceId: object.id,
      metadata: {
        provider: object.provider,
        key: object.key,
        contentType: object.contentType,
        sizeBytes: object.sizeBytes,
        visibility: object.visibility,
      },
    });
    return { object, upload };
  }

  async uploadLocal(
    id: string,
    input: { stream: Readable & { truncated?: boolean }; contentType: string },
    context: AuditContext & { actorId: string },
  ) {
    const object = await this.pending(id);
    if (object.createdAt.getTime() + this.settings.uploadExpirySeconds() * 1_000 <= Date.now()) {
      throw new ApiError(
        410,
        'STORAGE_UPLOAD_AUTHORIZATION_EXPIRED',
        'Upload authorization expired',
      );
    }
    if (object.provider !== 'local') {
      throw new ApiError(
        409,
        'STORAGE_UPLOAD_NOT_LOCAL',
        'This object uses direct provider upload',
      );
    }
    if (input.contentType.toLowerCase() !== object.contentType.toLowerCase()) {
      throw new ApiError(400, 'STORAGE_CONTENT_TYPE_MISMATCH', 'Uploaded content type changed');
    }
    const adapter = this.adapters.forProvider('local');
    if (!adapter.writeLocal) throw new Error('Local storage write capability is unavailable');
    const result = await adapter.writeLocal(object.key, input.stream);
    if (
      input.stream.truncated ||
      result.sizeBytes !== object.sizeBytes ||
      result.sizeBytes > this.settings.maxUploadBytes()
    ) {
      await adapter.delete(object.key, object.bucket);
      throw new ApiError(400, 'STORAGE_SIZE_MISMATCH', 'Uploaded file size changed');
    }
    const ready = await this.repository.markReady(id, {
      ...result,
      contentType: object.contentType,
    });
    if (!ready)
      throw new ApiError(409, 'STORAGE_UPLOAD_ALREADY_COMPLETED', 'Upload is not pending');
    await this.auditReady(ready, context);
    return { object: ready };
  }

  async complete(id: string, context: AuditContext & { actorId: string }) {
    const object = await this.pending(id);
    if (object.provider === 'local') {
      throw new ApiError(
        409,
        'STORAGE_LOCAL_UPLOAD_INCOMPLETE',
        'Upload the local file content first',
      );
    }
    const adapter = this.adapters.forProvider('s3');
    const result = await adapter.head(object.key, object.bucket);
    if (!result) throw new ApiError(409, 'STORAGE_OBJECT_MISSING', 'Uploaded object was not found');
    if (
      result.sizeBytes !== object.sizeBytes ||
      result.sizeBytes > this.settings.maxUploadBytes()
    ) {
      await adapter.delete(object.key, object.bucket);
      throw new ApiError(400, 'STORAGE_SIZE_MISMATCH', 'Uploaded file size changed');
    }
    if (
      result.contentType !== 'application/octet-stream' &&
      result.contentType.toLowerCase() !== object.contentType.toLowerCase()
    ) {
      await adapter.delete(object.key, object.bucket);
      throw new ApiError(400, 'STORAGE_CONTENT_TYPE_MISMATCH', 'Uploaded content type changed');
    }
    const ready = await this.repository.markReady(id, result);
    if (!ready)
      throw new ApiError(409, 'STORAGE_UPLOAD_ALREADY_COMPLETED', 'Upload is not pending');
    await this.auditReady(ready, context);
    return { object: ready };
  }

  async list(query: StorageObjectQuery) {
    const result = await this.repository.search(query);
    return {
      items: result.items,
      meta: paginationMeta({ page: query.page, pageSize: query.pageSize, total: result.total }),
    };
  }

  async get(id: string) {
    const object = await this.repository.findById(id);
    if (!object) throw new ApiError(404, 'STORAGE_OBJECT_NOT_FOUND', 'Storage object not found');
    return object;
  }

  async access(id: string) {
    const object = await this.ready(id);
    return this.adapters.forProvider(object.provider as 'local' | 's3').accessUrl({
      objectId: object.id,
      bucket: object.bucket,
      key: object.key,
      visibility: object.visibility as 'public' | 'private',
      expiresInSeconds: this.settings.accessExpirySeconds(),
    });
  }

  async localContent(id: string, publicOnly: boolean) {
    const object = await this.ready(id);
    if (object.provider !== 'local') {
      throw new ApiError(
        409,
        'STORAGE_OBJECT_NOT_LOCAL',
        'Object content is hosted by the provider',
      );
    }
    if (publicOnly && object.visibility !== 'public') {
      throw new ApiError(404, 'STORAGE_OBJECT_NOT_FOUND', 'Storage object not found');
    }
    const adapter = this.adapters.forProvider('local');
    if (!adapter.read) throw new Error('Local storage read capability is unavailable');
    const content = await adapter.read(object.key);
    return { ...content, contentType: object.contentType, filename: object.originalName };
  }

  async delete(id: string, context: AuditContext & { actorId: string }) {
    const object = await this.ready(id);
    await this.adapters
      .forProvider(object.provider as 'local' | 's3')
      .delete(object.key, object.bucket);
    const deleted = await this.repository.markDeleted(id);
    if (!deleted) throw new ApiError(409, 'STORAGE_OBJECT_NOT_READY', 'Object is not ready');
    await this.audit.record({
      ...context,
      action: 'storage.object_deleted',
      resourceType: 'storage_object',
      resourceId: id,
      metadata: { provider: object.provider, key: object.key },
    });
    return { object: deleted };
  }

  private validateUpload(input: CreateStorageUploadRequest): void {
    if (input.sizeBytes > this.settings.maxUploadBytes()) {
      throw new ApiError(413, 'STORAGE_FILE_TOO_LARGE', 'File exceeds the configured size limit');
    }
    const allowedTypes = this.settings.allowedMimeTypes();
    const allowed = allowedTypes.some((type) =>
      type.endsWith('/*')
        ? input.contentType.startsWith(type.slice(0, -1))
        : type === input.contentType,
    );
    if (!allowed)
      throw new ApiError(415, 'STORAGE_CONTENT_TYPE_REJECTED', 'File type is not allowed');
    const allowedPrefixes = this.settings.allowedPrefixes();
    if (
      !allowedPrefixes.some(
        (prefix) => input.prefix === prefix || input.prefix.startsWith(`${prefix}/`),
      )
    ) {
      throw new ApiError(400, 'STORAGE_PREFIX_REJECTED', 'Object path prefix is not allowed');
    }
  }

  private objectKey(prefix: string, filename: string): string {
    const now = new Date();
    const extension = extname(filename).toLowerCase();
    const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
    return `${prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}${safeExtension}`;
  }

  private async pending(id: string) {
    const object = await this.get(id);
    if (object.status !== 'pending') {
      throw new ApiError(409, 'STORAGE_UPLOAD_NOT_PENDING', 'Upload is not pending');
    }
    return object;
  }

  private async ready(id: string) {
    const object = await this.get(id);
    if (object.status !== 'ready') {
      throw new ApiError(409, 'STORAGE_OBJECT_NOT_READY', 'Storage object is not ready');
    }
    return object;
  }

  private async auditReady(
    object: Awaited<ReturnType<StorageRepository['markReady']>> & {},
    context: AuditContext & { actorId: string },
  ) {
    await this.audit.record({
      ...context,
      action: 'storage.object_ready',
      resourceType: 'storage_object',
      resourceId: object.id,
      metadata: { provider: object.provider, key: object.key, sizeBytes: object.sizeBytes },
    });
  }
}
