import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { ApiError } from '@lingcoo-tech/http';
import { z, type ZodType } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata?: ArgumentMetadata): T {
    void _metadata;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        z.treeifyError(result.error),
      );
    }
    return result.data;
  }
}
