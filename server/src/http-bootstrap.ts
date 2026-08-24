import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApiErrorResponse } from '@lingcoo-tech/http';

import { ApiErrorFilter } from './common/http/api-error.filter';

function corsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export async function configureHttpApplication(app: NestFastifyApplication): Promise<void> {
  const config = app.get(ConfigService);
  const workspaceRoot = resolve(__dirname, '../..');
  const adminRoot = resolve(workspaceRoot, 'admin/dist');
  const webRoot = resolve(workspaceRoot, 'web/dist');

  app.enableShutdownHooks();
  await app.register(cookie);
  app.useGlobalFilters(new ApiErrorFilter());
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableCors({
    origin: corsOrigins(config.getOrThrow<string>('CORS_ORIGIN')),
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: config.get<boolean>('API_DOCS_ENABLED') ? false : undefined,
  });
  if (existsSync(adminRoot)) {
    await app.register(fastifyStatic, {
      root: adminRoot,
      prefix: '/admin/',
      wildcard: false,
    });
  }
  if (existsSync(webRoot)) {
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: '/',
      decorateReply: !existsSync(adminRoot),
      wildcard: false,
    });
  }

  const adminIndex = existsSync(resolve(adminRoot, 'index.html'))
    ? readFileSync(resolve(adminRoot, 'index.html'), 'utf8')
    : null;
  const webIndex = existsSync(resolve(webRoot, 'index.html'))
    ? readFileSync(resolve(webRoot, 'index.html'), 'utf8')
    : null;
  const server = app.getHttpAdapter().getInstance();
  const notFound = (requestId: string) =>
    createApiErrorResponse({ code: 'NOT_FOUND', message: 'Resource not found' }, requestId);
  if (adminIndex) {
    server.get('/admin', (_request, reply) => reply.redirect('/admin/'));
    server.get('/admin/*', (request, reply) => {
      if (request.headers.accept?.includes('text/html')) {
        return reply.type('text/html; charset=utf-8').send(adminIndex);
      }
      return reply.status(404).send(notFound(request.id));
    });
  }
  if (webIndex) {
    server.get('/*', (request, reply) => {
      const pathname = (request.raw.url ?? '/').split('?')[0] ?? '/';
      if (
        request.headers.accept?.includes('text/html') &&
        !pathname.startsWith('/api/') &&
        !pathname.startsWith('/health/')
      ) {
        return reply.type('text/html; charset=utf-8').send(webIndex);
      }
      return reply.status(404).send(notFound(request.id));
    });
  }

  server.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id || randomUUID());
    done();
  });

  if (config.get<boolean>('API_DOCS_ENABLED')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(config.getOrThrow<string>('APP_NAME'))
        .setDescription('Application API')
        .setVersion(config.getOrThrow<string>('APP_VERSION'))
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
}
