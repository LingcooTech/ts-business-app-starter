import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkerRunner } from '../src/infrastructure/worker/worker-runner.service';
import { WorkerModule } from '../src/worker.module';

describe('WorkerModule', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => close?.());

  it('resolves the complete production worker dependency graph', async () => {
    const application = await NestFactory.createApplicationContext(WorkerModule, {
      logger: false,
    });
    close = () => application.close();

    expect(application.get(WorkerRunner)).toBeInstanceOf(WorkerRunner);
  });
});
