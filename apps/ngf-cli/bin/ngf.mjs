#!/usr/bin/env node
// Run via tsx for direct .ts execution: `npx tsx apps/ngf-cli/src/main.ts ...`.
// This shim exists so the package exposes a stable `ngf` bin once compiled.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../src/main.ts');
const r = spawnSync('npx', ['--yes', 'tsx', entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
