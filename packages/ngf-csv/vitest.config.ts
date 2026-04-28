import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@ngf/core': new URL('../ngf-core/src/index.ts', import.meta.url).pathname,
    },
  },
});
