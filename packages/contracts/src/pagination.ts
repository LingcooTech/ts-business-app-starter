import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(200).optional(),
});

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export const sortDirectionSchema = z.enum(['asc', 'desc']);

export function createSortQuerySchema<const T extends readonly [string, ...string[]]>(fields: T) {
  return z.object({
    sortBy: z.enum(fields).optional(),
    sortDirection: sortDirectionSchema.default('asc'),
  });
}

export function createPaginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

export function paginationMeta(input: {
  page: number;
  pageSize: number;
  total: number;
}): z.infer<typeof paginationMetaSchema> {
  return {
    ...input,
    totalPages: input.total === 0 ? 0 : Math.ceil(input.total / input.pageSize),
  };
}

export type PaginationQuery = z.output<typeof paginationQuerySchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type SortDirection = z.infer<typeof sortDirectionSchema>;
