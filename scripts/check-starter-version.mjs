#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const starterVersion = (await readFile(resolve(root, '.starter-version'), 'utf8')).trim();
const baseStarterVersion = (await readFile(resolve(root, '.base-starter-version'), 'utf8')).trim();
const rootPackage = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const cliPackage = JSON.parse(
  await readFile(resolve(root, 'create-ts-business-app-starter/package.json'), 'utf8'),
);

const failures = [];
if (!/^ts-app-starter@[0-9a-f]{40}$/.test(baseStarterVersion)) {
  failures.push(
    `.base-starter-version must pin a full ts-app-starter commit, received ${baseStarterVersion}`,
  );
}
if (rootPackage.version !== starterVersion) {
  failures.push(
    `root package version ${rootPackage.version} does not match .starter-version ${starterVersion}`,
  );
}
if (cliPackage.templateVersion !== starterVersion) {
  failures.push(
    `CLI templateVersion ${cliPackage.templateVersion} does not match .starter-version ${starterVersion}`,
  );
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `business starter and CLI template versions aligned at ${starterVersion}; base ${baseStarterVersion}`,
  );
}
