import { Hono } from 'hono';
import { irradianceQuerySchema } from '@chhatready/engine';
import { ApiError } from '../errors';
import { detectFileType } from '../services/blobs';
import type { Deps } from '../types';

export function miscRoutes(d: Deps) {
  const r = new Hono();

  r.get('/health', (c) => c.json({ ok: true, service: 'chhatready-api', mode: d.cfg.mock ? 'mock' : 'aws', mail: d.mailer.mode }));

  r.get('/irradiance', async (c) => {
    const q = irradianceQuerySchema.safeParse({ lat: c.req.query('lat'), lon: c.req.query('lon') });
    if (!q.success) throw new ApiError(400, 'VALIDATION', 'lat and lon are required numbers.');
    const y = await d.yields.get(q.data.lat, q.data.lon);
    return c.json(y);
  });

  if (d.cfg.mock) {
    // Stand-in for S3 presigned URLs when running without AWS.
    const keyOf = (path: string) => decodeURIComponent(path.slice(path.indexOf('/mock/blob/') + '/mock/blob/'.length));
    r.put('/mock/blob/*', async (c) => {
      const key = keyOf(c.req.path);
      if (!key.startsWith('uploads/') && !key.startsWith('packs/')) throw new ApiError(400, 'BAD_KEY', 'Invalid key.');
      const buf = new Uint8Array(await c.req.arrayBuffer());
      if (buf.length > d.cfg.maxUploadBytes) throw new ApiError(413, 'FILE_TOO_LARGE', 'That file is larger than 8 MB.');
      await d.blobs.putBytes(key, buf, c.req.header('content-type') ?? 'application/octet-stream');
      return c.body(null, 200);
    });
    r.get('/mock/blob/*', async (c) => {
      const key = keyOf(c.req.path);
      const bytes = await d.blobs.getBytes(key, d.cfg.maxUploadBytes);
      if (!bytes) throw new ApiError(404, 'NOT_FOUND', 'File not found.');
      const t = detectFileType(bytes);
      const type = t === 'png' ? 'image/png' : t === 'jpeg' ? 'image/jpeg' : t === 'pdf' ? 'application/pdf' : 'application/octet-stream';
      return c.body(bytes as unknown as ArrayBuffer, 200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=60' });
    });
  }
  return r;
}
