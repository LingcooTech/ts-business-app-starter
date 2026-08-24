import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import {
  ApiError,
  apiErrorResponseFromException,
  createApiErrorResponse,
} from '@lingcoo-tech/http';
import type { FastifyReply, FastifyRequest } from 'fastify';

type ErrorBody = { code?: string; message?: string | string[]; details?: unknown };

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const requestId = request.id;

    if (exception instanceof ApiError) {
      reply.status(exception.statusCode).send(apiErrorResponseFromException(exception, requestId));
      return;
    }

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
      reply.status(500).send(apiErrorResponseFromException(exception, requestId));
      return;
    }

    const status = exception.getStatus();
    const response = exception.getResponse();
    const body: ErrorBody = typeof response === 'string' ? { message: response } : response;
    const message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
    reply.status(status).send(
      createApiErrorResponse(
        {
          code: body.code ?? `HTTP_${status}`,
          message: message ?? exception.message,
          ...(body.details === undefined ? {} : { details: body.details }),
        },
        requestId,
      ),
    );
  }
}
