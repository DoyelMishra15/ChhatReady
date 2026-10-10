#!/usr/bin/env node
// Starts the API and the web app together. Default is mock mode (no AWS needed).
// Use `npm run dev -- --aws` to run the local API against real AWS (needs credentials and .env).
import { spawn } from 'node:child_process';

const aws = process.argv.includes('--aws');
const env = { ...process.env };
if (!aws) env.MOCK_AWS = '1';

const run = (name, args, color) => {
  const p = spawn('npm', args, { env, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (s) => s.on('data', (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(tag + l)));
  pipe(p.stdout);
  pipe(p.stderr);
  p.on('exit', (code) => {
    console.log(`${tag}exited with code ${code}`);
    shutdown(code ?? 1);
  });
  return p;
};

const children = [run('api', ['run', 'dev:api'], 36), run('web', ['run', 'dev:web'], 35)];
let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  children.forEach((c) => c.kill('SIGTERM'));
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
console.log(`\nChhatReady dev: ${aws ? 'AWS mode' : 'mock mode (no AWS needed)'}\n  App: http://localhost:5173\n  API: http://localhost:8787/health\n`);
