import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@kimasill/ngf-core': resolve(__dirname, '../../packages/ngf-core/src/index.ts'),
      '@kimasill/ngf-csv': resolve(__dirname, '../../packages/ngf-csv/src/index.ts'),
      '@kimasill/ngf-validate': resolve(__dirname, '../../packages/ngf-validate/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
