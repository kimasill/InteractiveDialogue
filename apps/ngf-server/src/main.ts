import { serve } from '@hono/node-server';
import app from './app.js';

const port = Number(process.env['PORT'] ?? 3100);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ngf-server listening on http://localhost:${info.port}`);
});
