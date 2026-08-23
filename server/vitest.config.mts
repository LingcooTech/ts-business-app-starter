import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@ts-business-app-starter/contracts': resolve(
        process.cwd(),
        '../packages/contracts/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.spec.ts'],
    env: {
      NODE_ENV: 'test',
      APP_NAME: 'ts-business-app-starter-test',
      APP_VERSION: 'test',
      API_HOST: '127.0.0.1',
      API_PORT: '8090',
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgres://test:test@127.0.0.1:5438/test',
      API_DOCS_ENABLED: 'false',
      AUTH_COOKIE_SECURE: 'false',
      AUTH_EXPOSE_TEST_TOKENS: 'true',
    },
  },
});
