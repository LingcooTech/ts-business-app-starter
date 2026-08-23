#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const project = `ts-business-app-starter-smoke-${process.pid}`;
const workdir = await mkdtemp(join(tmpdir(), 'ts-business-app-starter-docker-'));
const envFile = join(workdir, '.env');
const image = `ts-business-app-starter:smoke-${process.pid}`;
const hostPort = 18093 + (process.pid % 1000);
const ownerEmail = 'owner@example.com';
const ownerPassword = 'smoke-owner-password-123';
const env = [
  `APP_IMAGE=${image}`,
  'APP_NAME=ts-business-app-starter-smoke',
  'APP_VERSION=smoke',
  'CORS_ORIGIN=http://localhost:5173',
  'DATABASE_URL=postgres://app:app_password@postgres:5432/app',
  'API_DOCS_ENABLED=false',
  'AUTH_COOKIE_SECURE=true',
  'AUTH_EXPOSE_TEST_TOKENS=false',
  `BOOTSTRAP_OWNER_EMAIL=${ownerEmail}`,
  `BOOTSTRAP_OWNER_PASSWORD=${ownerPassword}`,
  'POSTGRES_DB=app',
  'POSTGRES_USER=app',
  'POSTGRES_PASSWORD=app_password',
  `HTTP_PORT=${hostPort}`,
  'CADDY_SITE_ADDRESS=:80',
].join('\n');

try {
  execFileSync('docker', ['info'], { stdio: 'ignore' });
} catch {
  console.error(
    'Docker smoke test requires a running Docker daemon. Start Docker Desktop or the Docker service and retry.',
  );
  process.exitCode = 1;
  process.exit();
}

function compose(args) {
  return execFileSync(
    'docker',
    ['compose', '-p', project, '-f', 'docker-compose.prod.yml', '--env-file', envFile, ...args],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
}

async function waitForReady(url, attempts = 30) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      execFileSync('curl', ['-fsS', url], { stdio: 'ignore' });
      return;
    } catch {
      if (attempt === attempts)
        throw new Error(`Docker smoke endpoint did not become ready: ${url}`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
    }
  }
}

try {
  await writeFile(envFile, `${env}\n`);
  execFileSync('docker', ['build', '--tag', image, '--build-arg', 'APP_VERSION=smoke', '.'], {
    cwd: root,
    stdio: 'inherit',
  });
  compose(['up', '-d', '--wait', 'postgres']);
  compose(['run', '--rm', '--no-deps', 'api', 'node', 'server/dist/migrate.js']);
  compose(['run', '--rm', '--no-deps', 'api', 'node', 'server/dist/bootstrap.js']);
  compose(['run', '--rm', '--no-deps', 'api', 'node', 'server/dist/bootstrap.js']);
  compose(['up', '-d', 'api', 'worker', 'caddy']);
  await waitForReady(`http://127.0.0.1:${hostPort}/health/ready`);
  execFileSync('curl', ['-fsS', `http://127.0.0.1:${hostPort}/health/live`], { stdio: 'inherit' });
  execFileSync(
    process.execPath,
    ['scripts/verify-auth-smoke.mjs', `http://127.0.0.1:${hostPort}`, ownerEmail, ownerPassword],
    { cwd: root, stdio: 'inherit' },
  );
  console.log('Docker production smoke test passed');
} finally {
  try {
    compose(['down', '--volumes', '--remove-orphans']);
  } catch {
    console.error(`Docker cleanup failed for compose project ${project}`);
  }
  try {
    execFileSync('docker', ['image', 'rm', '--force', image], { stdio: 'ignore' });
  } catch {
    // The image may not exist when build fails.
  }
  await rm(workdir, { recursive: true, force: true });
}
