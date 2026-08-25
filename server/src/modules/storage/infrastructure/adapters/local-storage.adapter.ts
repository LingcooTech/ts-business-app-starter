import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { Injectable } from '@nestjs/common';

import type { ObjectStoragePort } from '../../domain/storage.types';
import { StorageSettingsService } from '../../application/storage-settings.service';

@Injectable()
export class LocalStorageAdapter implements ObjectStoragePort {
  constructor(private readonly settings: StorageSettingsService) {}

  provider() {
    return 'local' as const;
  }

  async bucket(): Promise<string> {
    return 'local';
  }

  async authorizeUpload(input: {
    objectId: string;
    contentType: string;
    expiresInSeconds: number;
  }) {
    return {
      method: 'POST' as const,
      url: `/api/storage/uploads/${input.objectId}/content`,
      headers: { accept: 'application/json' },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
    };
  }

  async writeLocal(key: string, stream: Readable) {
    const path = this.path(key);
    const temporary = `${path}.${crypto.randomUUID()}.upload`;
    await mkdir(dirname(path), { recursive: true });
    const hash = createHash('sha256');
    let sizeBytes = 0;
    const digest = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sizeBytes += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    try {
      await pipeline(stream, digest, createWriteStream(temporary, { flags: 'wx' }));
      await rename(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    return { sizeBytes, contentType: 'application/octet-stream', etag: hash.digest('hex') };
  }

  async head(key: string) {
    try {
      const info = await stat(this.path(key));
      return { sizeBytes: info.size, contentType: 'application/octet-stream', etag: null };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async read(key: string) {
    const path = this.path(key);
    const info = await stat(path);
    return {
      stream: createReadStream(path),
      contentType: 'application/octet-stream',
      sizeBytes: info.size,
    };
  }

  async accessUrl(input: { objectId: string; visibility: 'public' | 'private' }) {
    return {
      url:
        input.visibility === 'public'
          ? `/api/storage/public/${input.objectId}`
          : `/api/storage/objects/${input.objectId}/content`,
      expiresAt: null,
    };
  }

  async delete(key: string): Promise<void> {
    await unlink(this.path(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  async test(): Promise<void> {
    const directory = resolve(this.settings.localRoot());
    await mkdir(directory, { recursive: true });
    await stat(directory);
  }

  private path(key: string): string {
    const root = resolve(this.settings.localRoot());
    const path = resolve(root, key);
    if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error('Unsafe storage key');
    return path;
  }
}
