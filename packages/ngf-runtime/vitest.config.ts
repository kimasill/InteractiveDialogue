import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { environment: 'node' },
  resolve: {
    alias: {
      '@ngf/core': resolve(__dirname, '../ngf-core/src/index.ts'),
      '@ngf/csv': resolve(__dirname, '../ngf-csv/src/index.ts'),
    },
  },
});
