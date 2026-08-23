#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const generator = resolve(root, 'scripts/generate-module.mjs');
const boundaryCheck = resolve(root, 'scripts/check-module-boundaries.mjs');
const target = await mkdtemp(join(tmpdir(), 'ts-business-module-generator-'));
const environment = { ...process.env, TS_BUSINESS_MODULE_ROOT: target };

try {
  await mkdir(join(target, 'server/src/modules'), { recursive: true });
  execFileSync(process.execPath, [generator, 'example'], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  });

  const expected = [
    'server/src/modules/example/example.module.ts',
    'server/src/modules/example/public.ts',
    'server/src/modules/example/api/example.controller.ts',
    'server/src/modules/example/application/example.service.ts',
    'server/src/modules/example/domain/README.md',
    'server/src/modules/example/infrastructure/persistence/example.schema.ts',
    'server/test/modules/example.service.spec.ts',
  ];
  await Promise.all(expected.map((path) => access(join(target, path))));

  const publicEntry = await readFile(join(target, 'server/src/modules/example/public.ts'), 'utf8');
  if (!publicEntry.includes('ExampleModule')) {
    throw new Error('generated public.ts does not export the NestJS module');
  }

  execFileSync(process.execPath, [boundaryCheck], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  });

  let duplicateRejected = false;
  try {
    execFileSync(process.execPath, [generator, 'example'], {
      cwd: root,
      env: environment,
      stdio: 'ignore',
    });
  } catch {
    duplicateRejected = true;
  }
  if (!duplicateRejected) throw new Error('generator overwrote an existing module');

  execFileSync(process.execPath, [generator, 'other'], {
    cwd: root,
    env: environment,
    stdio: 'ignore',
  });
  await writeFile(
    join(target, 'server/src/modules/example/application/example.service.ts'),
    `import { OtherService } from '../../other/application/other.service';\n\nexport class ExampleService extends OtherService {}\n`,
    'utf8',
  );
  let internalImportRejected = false;
  try {
    execFileSync(process.execPath, [boundaryCheck], {
      cwd: root,
      env: environment,
      stdio: 'ignore',
    });
  } catch {
    internalImportRejected = true;
  }
  if (!internalImportRejected) {
    throw new Error('boundary check allowed a cross-module internal import');
  }

  console.log('module generator smoke test passed');
} finally {
  await rm(target, { recursive: true, force: true });
}
