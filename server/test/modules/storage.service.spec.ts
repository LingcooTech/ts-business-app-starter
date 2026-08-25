import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../src/modules/audit/public';
import { StorageService } from '../../src/modules/storage/application/storage.service';
import type { StorageSettingsService } from '../../src/modules/storage/application/storage-settings.service';
import type { ObjectStoragePort } from '../../src/modules/storage/domain/storage.types';
import { LocalStorageAdapter } from '../../src/modules/storage/infrastructure/adapters/local-storage.adapter';
import type { StorageAdapterFactory } from '../../src/modules/storage/infrastructure/adapters/storage-adapter.factory';
import type { StorageRepository } from '../../src/modules/storage/infrastructure/persistence/storage.repository';

const context = {
  actorType: 'user' as const,
  actorId: 'fdda765f-fc57-5604-a269-52a7df8164ec',
  requestId: 'request-storage-test',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

const pendingObject = {
  id: '9f2148c5-7ddb-4b17-85f7-700eab5ba697',
  provider: 's3',
  bucket: 'media-bucket',
  key: 'media/2026/08/object.txt',
  originalName: 'object.txt',
  contentType: 'text/plain',
  sizeBytes: 5,
  visibility: 'private',
  status: 'pending',
  etag: null,
  createdBy: context.actorId,
  uploadedAt: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function harness(overrides: { maxUploadBytes?: number; object?: typeof pendingObject } = {}) {
  const repository = {
    create: vi.fn().mockImplementation(async (input) => ({ ...pendingObject, ...input })),
    findById: vi.fn().mockResolvedValue(overrides.object ?? pendingObject),
    markReady: vi.fn(),
  } as unknown as StorageRepository;
  const adapter = {
    provider: vi.fn().mockReturnValue('s3'),
    bucket: vi.fn().mockResolvedValue('media-bucket'),
    authorizeUpload: vi.fn().mockResolvedValue({
      method: 'PUT',
      url: 'https://storage.example.com/upload',
      headers: { 'content-type': 'text/plain' },
      expiresAt: new Date('2026-08-25T02:00:00Z'),
    }),
    head: vi.fn().mockResolvedValue({ sizeBytes: 6, contentType: 'text/plain', etag: 'etag' }),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as ObjectStoragePort;
  const adapters = {
    current: vi.fn().mockResolvedValue(adapter),
    forProvider: vi.fn().mockReturnValue(adapter),
  } as unknown as StorageAdapterFactory;
  const settings = {
    maxUploadBytes: vi.fn().mockReturnValue(overrides.maxUploadBytes ?? 100),
    allowedMimeTypes: vi.fn().mockReturnValue(['image/*', 'text/plain']),
    allowedPrefixes: vi.fn().mockReturnValue(['media', 'documents']),
    uploadExpirySeconds: vi.fn().mockReturnValue(900),
    accessExpirySeconds: vi.fn().mockReturnValue(900),
  } as unknown as StorageSettingsService;
  const audit = { record: vi.fn().mockResolvedValue({}) } as unknown as AuditService;
  return {
    service: new StorageService(repository, adapters, settings, audit),
    repository,
    adapter,
    audit,
  };
}

describe('StorageService', () => {
  it('rejects files outside the configured size, MIME, and prefix policies', async () => {
    const { service } = harness({ maxUploadBytes: 4 });
    await expect(
      service.authorize(
        {
          filename: 'large.txt',
          contentType: 'text/plain',
          sizeBytes: 5,
          visibility: 'private',
          prefix: 'media',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'STORAGE_FILE_TOO_LARGE' });

    const normal = harness().service;
    await expect(
      normal.authorize(
        {
          filename: 'script.js',
          contentType: 'application/javascript',
          sizeBytes: 3,
          visibility: 'private',
          prefix: 'media',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'STORAGE_CONTENT_TYPE_REJECTED' });
    await expect(
      normal.authorize(
        {
          filename: 'file.txt',
          contentType: 'text/plain',
          sizeBytes: 3,
          visibility: 'private',
          prefix: 'untrusted',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'STORAGE_PREFIX_REJECTED' });
  });

  it('generates the provider key server-side and audits upload authorization', async () => {
    const { service, repository, adapter, audit } = harness();
    const result = await service.authorize(
      {
        filename: '../../Quarterly Report.TXT',
        contentType: 'text/plain',
        sizeBytes: 5,
        visibility: 'public',
        prefix: 'documents/reports',
      },
      context,
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^documents\/reports\/\d{4}\/\d{2}\/[0-9a-f-]+\.txt$/),
        originalName: '../../Quarterly Report.TXT',
      }),
    );
    expect(adapter.authorizeUpload).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.not.stringContaining('Quarterly Report') }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'storage.upload_authorized' }),
    );
    expect(result.upload.method).toBe('PUT');
  });

  it('deletes provider data when completion metadata violates the declared size', async () => {
    const { service, adapter, repository } = harness();
    await expect(service.complete(pendingObject.id, context)).rejects.toMatchObject({
      code: 'STORAGE_SIZE_MISMATCH',
    });
    expect(adapter.head).toHaveBeenCalledWith(pendingObject.key, pendingObject.bucket);
    expect(adapter.delete).toHaveBeenCalledWith(pendingObject.key, pendingObject.bucket);
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it('rejects expired local upload authorizations before writing content', async () => {
    const expired = {
      ...pendingObject,
      provider: 'local',
      bucket: 'local',
      createdAt: new Date(Date.now() - 901_000),
    };
    const { service, adapter } = harness({ object: expired });
    adapter.writeLocal = vi.fn();

    await expect(
      service.uploadLocal(
        expired.id,
        {
          stream: Object.assign(Readable.from('hello'), { truncated: false }),
          contentType: 'text/plain',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'STORAGE_UPLOAD_AUTHORIZATION_EXPIRED' });
    expect(adapter.writeLocal).not.toHaveBeenCalled();
  });
});

describe('LocalStorageAdapter', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('rejects keys that escape the configured storage root', async () => {
    root = await mkdtemp(join(tmpdir(), 'storage-adapter-'));
    const settings = { localRoot: () => root } as unknown as StorageSettingsService;
    const adapter = new LocalStorageAdapter(settings);

    await expect(adapter.writeLocal('../escape.txt', Readable.from('unsafe'))).rejects.toThrow(
      'Unsafe storage key',
    );
  });
});
