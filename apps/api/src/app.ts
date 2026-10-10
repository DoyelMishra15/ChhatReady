import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ApiError } from './errors';
import { actionRoutes } from './routes/actions';
import { caseRoutes } from './routes/cases';
import { miscRoutes } from './routes/misc';
import { quoteRoutes } from './routes/quotes';
import type { Deps } from './types';

export function createApp(d: Deps) {
  const app = new Hono();
  const origins = d.cfg.allowedOrigins;
  app.use(
    '*',
    cors({
      origin: (origin) => (origins.includes('*') ? origin || '*' : origins.includes(origin) ? origin : ''),
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      maxAge: 600
    })
  );

  app.route('/', miscRoutes(d));
  app.route('/', caseRoutes(d));
  app.route('/', actionRoutes(d));
  app.route('/', quoteRoutes(d));

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }, 404));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ error: { code: err.code, message: err.message, hint: err.hint } }, err.status as ContentfulStatusCode);
    }
    d.log.error('unhandled error', { path: c.req.path, name: err.name, message: err.message });
    return c.json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side.', hint: 'Please try again in a moment.' } }, 500);
  });

  return app;
}
