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
  'PUBLIC_WEB_URL=http://localhost',
  'DATABASE_URL=postgres://app:app_password@postgres:5432/app',
  'API_DOCS_ENABLED=false',
  'AUTH_COOKIE_SECURE=true',
  'AUTH_EXPOSE_TEST_TOKENS=false',
  'SETTINGS_ENCRYPTION_CURRENT_KEY_ID=smoke-v1',
  'SETTINGS_ENCRYPTION_KEYS={"smoke-v1":"smoke-settings-encryption-key-123456789"}',
  'MAIL_TRANSPORT=log',
  'PAYMENT_PROVIDER=mock',
  'JOB_POLL_INTERVAL_MS=50',
  'JOB_BACKOFF_BASE_MS=100',
  'JOB_BACKOFF_MAX_MS=200',
  'JOB_LOCK_TIMEOUT_SECONDS=10',
  'JOB_HEARTBEAT_INTERVAL_MS=1000',
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

function composeCapture(args) {
  return execFileSync(
    'docker',
    ['compose', '-p', project, '-f', 'docker-compose.prod.yml', '--env-file', envFile, ...args],
    { cwd: root, encoding: 'utf8' },
  ).trim();
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
  composeCapture([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'app',
    '-d',
    'app',
    '-c',
    "insert into jobs(type, payload, max_attempts, idempotency_key) values ('smoke.always-fails', '{}', 2, 'docker-smoke-retry'); insert into jobs(type, payload, status, attempts, max_attempts, idempotency_key, locked_by, locked_at, heartbeat_at) values ('smoke.stale-lock', '{}', 'running', 0, 1, 'docker-smoke-stale', 'dead-worker', now() - interval '1 hour', now() - interval '1 hour')",
  ]);
  compose(['up', '-d', '--wait', '--scale', 'worker=2', 'api', 'worker', 'caddy']);
  await waitForReady(`http://127.0.0.1:${hostPort}/health/ready`);
  execFileSync('curl', ['-fsS', `http://127.0.0.1:${hostPort}/health/live`], { stdio: 'inherit' });
  for (const route of [
    '/',
    '/account',
    '/admin/',
    '/admin/login',
    '/admin/access',
    '/admin/settings',
    '/admin/audit',
    '/admin/jobs',
    '/admin/mail',
    '/admin/notifications',
    '/admin/storage',
    '/admin/payments',
  ]) {
    execFileSync(
      'curl',
      ['-fsS', '-H', 'Accept: text/html', `http://127.0.0.1:${hostPort}${route}`],
      { stdio: 'ignore' },
    );
  }
  execFileSync(
    process.execPath,
    ['scripts/verify-auth-smoke.mjs', `http://127.0.0.1:${hostPort}`, ownerEmail, ownerPassword],
    { cwd: root, stdio: 'inherit' },
  );
  const secretStorage = composeCapture([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'app',
    '-d',
    'app',
    '-tAc',
    "select count(*) from system_settings where key = 'integrations.smtp-password' and value_json is null and encrypted_value is not null and key_id = 'smoke-v1' and encrypted_value::text not like '%docker-smoke-plaintext-secret%'",
  ]);
  if (secretStorage !== '1') throw new Error('sensitive setting was not stored as ciphertext');

  const stageFiveState = composeCapture([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'app',
    '-d',
    'app',
    '-tAc',
    "select (select status || ':' || attempts from jobs where idempotency_key = 'docker-smoke-retry') || ',' || (select status || ':' || attempts from jobs where idempotency_key = 'docker-smoke-stale') || ',' || (select count(*) from job_attempts where job_id = (select id from jobs where idempotency_key = 'docker-smoke-retry')) || ',' || (select count(*) from notification_announcements a join outbox_events o on o.id = a.outbox_event_id where a.dedupe_key = 'docker-stage5-smoke-notification') || ',' || (select count(*) from notifications where dedupe_key = 'docker-stage5-smoke-notification')",
  ]);
  if (stageFiveState !== 'dead:2,dead:1,2,1,1') {
    throw new Error(`stage 5 worker invariants failed: ${stageFiveState}`);
  }

  const storageState = composeCapture([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'app',
    '-d',
    'app',
    '-tAc',
    "select (select count(*) from storage_objects where original_name = 'storage-smoke.txt' and provider = 'local' and status = 'deleted' and size_bytes = 23 and etag is not null) || ',' || (select count(*) from audit_logs where resource_type = 'storage_object' and action in ('storage.upload_authorized', 'storage.object_ready', 'storage.object_deleted'))",
  ]);
  if (storageState !== '1,3') {
    throw new Error(`stage 6 storage invariants failed: ${storageState}`);
  }

  const paymentState = composeCapture([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'app',
    '-d',
    'app',
    '-tAc',
    "select (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('payment_intents', 'payment_refunds', 'payment_callbacks')) || ',' || (select count(*) from payment_intents) || ',' || (select count(*) from pg_constraint where conname = 'audit_logs_actor_type_check' and pg_get_constraintdef(oid) like '%provider%')",
  ]);
  if (paymentState !== '3,0,1') {
    throw new Error(`stage 7 payment invariants failed: ${paymentState}`);
  }

  let immutable = false;
  try {
    composeCapture([
      'exec',
      '-T',
      'postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'app',
      '-d',
      'app',
      '-c',
      "update audit_logs set action = 'tampered' where action = 'settings.updated'",
    ]);
  } catch {
    immutable = true;
  }
  if (!immutable) throw new Error('audit log database immutability guard did not reject an update');
  console.log('Docker production smoke test passed');
} catch (error) {
  try {
    compose(['logs', '--no-color', '--tail', '300', 'api', 'worker']);
  } catch {
    console.error('Unable to collect Docker service logs after smoke failure');
  }
  throw error;
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
