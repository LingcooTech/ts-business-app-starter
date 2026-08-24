import { Controller, Get, Param, Query } from '@nestjs/common';
import { auditQuerySchema, entityIdSchema } from '@ts-business-app-starter/contracts';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { AuditService } from '../application/audit.service';

@Controller('audit')
@RequirePermissions('audit.read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query(new ZodValidationPipe(auditQuerySchema)) query: unknown) {
    return this.audit.list(auditQuerySchema.parse(query));
  }

  @Get(':id')
  get(@Param('id', new ZodValidationPipe(entityIdSchema)) id: unknown) {
    return this.audit.get(entityIdSchema.parse(id));
  }
}
