#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'create-ts-business-app-starter/cli.mjs');
const projectName = 'generated-smoke-app';
const target = await mkdtemp(join(tmpdir(), 'ts-business-app-starter-generated-'));
const project = join(target, projectName);

try {
  execFileSync(
    process.execPath,
    [cli, project, '--skip-install', '--no-git', '--template-path', root],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );

  const starterVersion = (await readFile(resolve(root, '.starter-version'), 'utf8')).trim();
  const generatedVersion = (await readFile(join(project, '.starter-version'), 'utf8')).trim();
  if (generatedVersion !== starterVersion) {
    throw new Error(
      `generated .starter-version is ${generatedVersion}, expected ${starterVersion}`,
    );
  }

  const packageJson = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
  if (packageJson.name !== projectName) {
    throw new Error(`generated package name is ${packageJson.name}, expected ${projectName}`);
  }
  for (const script of ['check:starter-version', 'smoke:generated']) {
    if (script in packageJson.scripts) {
      throw new Error(`generated project contains maintainer-only script ${script}`);
    }
  }
  if (packageJson.scripts.check.includes('check:starter-version')) {
    throw new Error('generated project check script still invokes check:starter-version');
  }
  for (const path of [
    '.base-starter-version',
    'create-ts-business-app-starter',
    'scripts/check-starter-version.mjs',
    'scripts/verify-generated-project.mjs',
  ]) {
    try {
      await access(join(project, path));
      throw new Error(`generated project contains maintainer-only file ${path}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  const textExtensions = new Set([
    '.md',
    '.json',
    '.ts',
    '.tsx',
    '.js',
    '.mjs',
    '.mts',
    '.css',
    '.yml',
    '.yaml',
    '.html',
    '.env',
    '.example',
    '.sql',
    '.toml',
  ]);
  const forbidden = ['ts-business-app-starter', '@ts-business-app-starter/'];
  const forbiddenDirectories = new Set([
    'node_modules',
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
  ]);
  const failures = [];
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      if (entry.name === '.env' || entry.name === '.DS_Store') {
        failures.push(`${join(directory, entry.name)}: generated project contains local state`);
        continue;
      }
      if (entry.isDirectory() && forbiddenDirectories.has(entry.name)) {
        failures.push(`${join(directory, entry.name)}: generated project contains build artifact`);
        continue;
      }
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await scan(path);
        continue;
      }
      const extension = entry.name.includes('.') ? `.${entry.name.split('.').pop()}` : '';
      if (!textExtensions.has(extension) && !entry.name.startsWith('.env')) continue;
      const content = (await readFile(path, 'utf8')).replaceAll(
        'create-ts-business-app-starter',
        '',
      );
      for (const marker of forbidden) {
        if (content.includes(marker)) failures.push(`${path}: found ${marker}`);
      }
    }
  }
  await scan(project);
  if (failures.length > 0)
    throw new Error(`generated project validation failed:\n${failures.join('\n')}`);

  execFileSync('corepack', ['pnpm', 'install', '--prefer-offline', '--frozen-lockfile'], {
    cwd: project,
    stdio: 'inherit',
  });
  execFileSync('corepack', ['pnpm', 'check'], {
    cwd: project,
    stdio: 'inherit',
  });

  console.log('generated project install and quality smoke test passed');
} finally {
  await rm(target, { recursive: true, force: true });
}
