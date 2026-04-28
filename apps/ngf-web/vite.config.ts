import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@kibbel/ngf-core': resolve(__dirname, '../../packages/ngf-core/src/index.ts'),
      '@kibbel/ngf-csv': resolve(__dirname, '../../packages/ngf-csv/src/index.ts'),
      '@kibbel/ngf-validate': resolve(__dirname, '../../packages/ngf-validate/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
