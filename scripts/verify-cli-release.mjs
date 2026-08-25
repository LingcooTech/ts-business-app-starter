#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'create-ts-business-app-starter/cli.mjs');
const packageRoot = resolve(root, 'create-ts-business-app-starter');
const targetRoot = await mkdtemp(join(tmpdir(), 'ts-business-cli-release-'));

try {
  const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--dry-run'], {
      cwd: packageRoot,
      encoding: 'utf8',
    }),
  );
  const files = new Set(packed[0]?.files?.map((file) => file.path) ?? []);
  for (const required of ['cli.mjs', 'README.md', 'package.json']) {
    if (!files.has(required)) throw new Error(`release package omits ${required}`);
  }
  if (packageJson.bin?.['create-ts-business-app-starter'] !== 'cli.mjs') {
    throw new Error('release package bin entry is invalid');
  }

  const occupied = join(targetRoot, 'occupied');
  await mkdir(occupied, { recursive: true });
  await writeFile(join(occupied, 'keep.txt'), 'do not overwrite');
  let rejected = false;
  try {
    execFileSync(
      process.execPath,
      [cli, occupied, '--skip-install', '--no-git', '--template-path', root],
      {
        cwd: root,
        stdio: 'pipe',
      },
    );
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('CLI did not reject a non-empty target without --force');

  execFileSync(
    process.execPath,
    [cli, occupied, '--force', '--skip-install', '--no-git', '--template-path', root],
    { cwd: root, stdio: 'inherit' },
  );
  const forcedPackage = JSON.parse(await readFile(join(occupied, 'package.json'), 'utf8'));
  if (forcedPackage.name !== 'occupied') throw new Error('--force replacement identity is wrong');

  const project = join(targetRoot, 'release-smoke-app');
  execFileSync(
    process.execPath,
    [cli, project, '--skip-install', '--no-git', '--template-path', root],
    { cwd: root, stdio: 'inherit' },
  );
  const generated = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
  if (generated.name !== 'release-smoke-app')
    throw new Error('generated package identity is wrong');
  if (generated.scripts['check:starter-version'])
    throw new Error('generated package contains maintainer-only scripts');

  console.log('CLI release package and target safety smoke test passed');
} finally {
  await rm(targetRoot, { recursive: true, force: true });
}
