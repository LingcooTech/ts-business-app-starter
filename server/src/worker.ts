import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module';
import { WorkerRunner } from './infrastructure/worker/worker-runner.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Worker');
  const runner = app.get(WorkerRunner);
  let stopping = false;

  logger.log(
    `${config.getOrThrow<string>('APP_NAME')} worker ${runner.id()} started (${config.getOrThrow<string>('APP_VERSION')})`,
  );
  runner.start();

  await new Promise<void>((resolve) => {
    const keepAlive = setInterval(() => undefined, 60_000);
    const shutdown = (signal: NodeJS.Signals) => {
      if (stopping) return;
      stopping = true;
      logger.log(`Worker received ${signal}; shutting down`);
      clearInterval(keepAlive);
      void runner
        .stop()
        .then(() => app.close())
        .then(resolve);
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  });
}

void bootstrap();
