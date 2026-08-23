#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('Usage: pnpm generate:module <module-name>');
  process.exit(1);
}

const root = process.env.TS_BUSINESS_MODULE_ROOT
  ? resolve(process.env.TS_BUSINESS_MODULE_ROOT)
  : resolve(import.meta.dirname, '..');
const directory = join(root, 'server/src/modules', name);
const testDirectory = join(root, 'server/test/modules');
const className = name
  .split('-')
  .map((part) => part[0].toUpperCase() + part.slice(1))
  .join('');
const files = {
  [`${name}.module.ts`]: `import { Module } from '@nestjs/common';\n\nimport { ${className}Controller } from './api/${name}.controller';\nimport { ${className}Service } from './application/${name}.service';\n\n@Module({\n  controllers: [${className}Controller],\n  providers: [${className}Service],\n})\nexport class ${className}Module {}\n`,
  'public.ts': `export { ${className}Module } from './${name}.module';\n`,
  [`api/${name}.controller.ts`]: `import { Controller, Get } from '@nestjs/common';\n\nimport { ${className}Service } from '../application/${name}.service';\n\n@Controller('${name}')\nexport class ${className}Controller {\n  constructor(private readonly service: ${className}Service) {}\n\n  @Get('status')\n  status() {\n    return this.service.status();\n  }\n}\n`,
  [`application/${name}.service.ts`]: `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class ${className}Service {\n  status() {\n    return { module: '${name}', status: 'ok' as const };\n  }\n}\n`,
  [`infrastructure/persistence/${name}.schema.ts`]: `// Add Drizzle tables owned by the ${name} module here.\nexport {};\n`,
  'domain/README.md': `# Domain\n\nKeep framework-neutral ${name} rules, value objects, and domain errors here when the module needs them.\n`,
  'README.md': `# ${className} module\n\nThis module owns its HTTP API, application use cases, domain rules, persistence schema, and adapters. Other modules may only import from \`public.ts\`.\n`,
};

await mkdir(directory, { recursive: false });
await Promise.all([
  mkdir(join(directory, 'api')),
  mkdir(join(directory, 'application')),
  mkdir(join(directory, 'domain')),
  mkdir(join(directory, 'infrastructure/persistence'), { recursive: true }),
]);
for (const [file, content] of Object.entries(files)) {
  await writeFile(join(directory, file), content);
}
await mkdir(testDirectory, { recursive: true });
await writeFile(
  join(testDirectory, `${name}.service.spec.ts`),
  `import { ${className}Service } from '../../src/modules/${name}/application/${name}.service';\n\ndescribe('${className}Service', () => {\n  it('reports the module status', () => {\n    expect(new ${className}Service().status()).toEqual({ module: '${name}', status: 'ok' });\n  });\n});\n`,
);
console.log(`created server/src/modules/${name}`);
console.log(`created server/test/modules/${name}.service.spec.ts`);
console.log(`register ${className}Module in server/src/app.module.ts when ready`);
