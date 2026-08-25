import { z } from 'zod';

import { entityIdSchema, isoDateTimeSchema } from './common.js';
import { createPaginatedResponseSchema, paginationQuerySchema } from './pagination.js';

export const storageProviderSchema = z.enum(['local', 's3']);
export const storageVisibilitySchema = z.enum(['public', 'private']);
export const storageObjectStatusSchema = z.enum(['pending', 'ready', 'deleted']);

export const storageObjectSchema = z.object({
  id: entityIdSchema,
  provider: storageProviderSchema,
  bucket: z.string().min(1).max(255),
  key: z.string().min(1).max(1024),
  originalName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  visibility: storageVisibilitySchema,
  status: storageObjectStatusSchema,
  etag: z.string().nullable(),
  createdBy: entityIdSchema.nullable(),
  uploadedAt: isoDateTimeSchema.nullable(),
  deletedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const storageObjectQuerySchema = paginationQuerySchema.extend({
  provider: storageProviderSchema.optional(),
  visibility: storageVisibilitySchema.optional(),
  status: storageObjectStatusSchema.optional(),
  prefix: z.string().trim().min(1).max(120).optional(),
});

export const storageObjectListResponseSchema = createPaginatedResponseSchema(storageObjectSchema);

export const createStorageUploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().toLowerCase().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  visibility: storageVisibilitySchema.default('private'),
  prefix: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9/_-]{0,119}$/)
    .default('media'),
});

export const storageUploadAuthorizationSchema = z.object({
  object: storageObjectSchema,
  upload: z.object({
    method: z.enum(['POST', 'PUT']),
    url: z.string().min(1),
    headers: z.record(z.string(), z.string()),
    expiresAt: isoDateTimeSchema,
  }),
});

export const storageObjectResponseSchema = z.object({ object: storageObjectSchema });
export const storageAccessResponseSchema = z.object({
  url: z.string().min(1),
  expiresAt: isoDateTimeSchema.nullable(),
});

export type StorageProvider = z.infer<typeof storageProviderSchema>;
export type StorageVisibility = z.infer<typeof storageVisibilitySchema>;
export type StorageObjectStatus = z.infer<typeof storageObjectStatusSchema>;
export type StorageObject = z.infer<typeof storageObjectSchema>;
export type StorageObjectQuery = z.output<typeof storageObjectQuerySchema>;
export type CreateStorageUploadRequest = z.output<typeof createStorageUploadRequestSchema>;
export type StorageUploadAuthorization = z.infer<typeof storageUploadAuthorizationSchema>;
