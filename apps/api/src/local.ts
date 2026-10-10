import { serve } from '@hono/node-server';
import { createApp } from './app';
import { buildDeps } from './deps';

const deps = buildDeps();
const port = Number(process.env.PORT || 8787);
serve({ fetch: createApp(deps).fetch, port, hostname: '0.0.0.0' });
console.log(`ChhatReady API on http://localhost:${port}  (${deps.cfg.mock ? 'MOCK_AWS mode' : `AWS mode, region ${deps.cfg.region}`})`);
