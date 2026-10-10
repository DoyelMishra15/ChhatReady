import { handle } from 'hono/aws-lambda';
import { createApp } from './app';
import { buildDeps } from './deps';

export const handler = handle(createApp(buildDeps()));
