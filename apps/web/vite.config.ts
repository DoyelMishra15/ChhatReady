import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiTarget = process.env.API_TARGET || 'http://localhost:8787';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev the browser talks to /api on the same origin, so Codespaces port forwarding needs no CORS setup.
    proxy: { '/api': { target: apiTarget, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } }
  },
  preview: { proxy: { '/api': { target: apiTarget, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } } },
  build: { chunkSizeWarningLimit: 1500, sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] }
});
