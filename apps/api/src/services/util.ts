import { createHash } from 'node:crypto';
import { customAlphabet } from 'nanoid';
import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { ApiError } from '../errors';

const alphabet = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 16);
export const newId = () => alphabet();
export const newShort = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 8);
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const ID_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{16}$/;

export async function parseBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw new ApiError(400, 'BAD_JSON', 'Request body must be valid JSON.');
  }
  const r = schema.safeParse(json);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new ApiError(400, 'VALIDATION', `Invalid input: ${first?.path.join('.') || 'body'} ${first?.message ?? ''}`.trim());
  }
  return r.data;
}
