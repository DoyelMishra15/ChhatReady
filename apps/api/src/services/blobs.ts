import fs from 'node:fs';
import path from 'node:path';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiError } from '../errors';

export interface PresignedPut {
  url: string;
  headers: Record<string, string>;
}

export interface Blobs {
  presignPut(key: string, contentType: string): Promise<PresignedPut>;
  presignGet(key: string, opts?: { expiresSec?: number; downloadName?: string }): Promise<string>;
  getBytes(key: string, maxBytes: number): Promise<Uint8Array | null>;
  putBytes(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  head(key: string): Promise<{ size: number } | null>;
  deletePrefix(prefix: string): Promise<number>;
}

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.\-]{4,250}$/;
export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes('..')) throw new ApiError(400, 'BAD_KEY', 'Invalid file key.');
}

export class S3Blobs implements Blobs {
  constructor(
    private s3: S3Client,
    private bucket: string
  ) {}

  async presignPut(key: string, contentType: string): Promise<PresignedPut> {
    assertSafeKey(key);
    const url = await getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: 300,
      signableHeaders: new Set(['content-type'])
    });
    return { url, headers: { 'Content-Type': contentType } };
  }

  async presignGet(key: string, opts: { expiresSec?: number; downloadName?: string } = {}): Promise<string> {
    assertSafeKey(key);
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: opts.downloadName ? `attachment; filename="${opts.downloadName}"` : undefined
      }),
      { expiresIn: opts.expiresSec ?? 3600 }
    );
  }

  async head(key: string) {
    try {
      const r = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: r.ContentLength ?? 0 };
    } catch (e) {
      if ((e as { name?: string }).name === 'NotFound' || (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
        return null;
      throw e;
    }
  }

  async getBytes(key: string, maxBytes: number) {
    assertSafeKey(key);
    const h = await this.head(key);
    if (!h) return null;
    if (h.size > maxBytes) {
      await this.deletePrefix(key);
      throw new ApiError(413, 'FILE_TOO_LARGE', 'That file is larger than 8 MB.', 'Upload a smaller photo or a one-page PDF.');
    }
    const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return r.Body ? await r.Body.transformToByteArray() : null;
  }

  async putBytes(key: string, bytes: Uint8Array, contentType: string) {
    assertSafeKey(key);
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType }));
  }

  async deletePrefix(prefix: string) {
    let deleted = 0;
    let token: string | undefined;
    do {
      const list = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      const objs = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (objs.length) {
        await this.s3.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objs } }));
        deleted += objs.length;
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }
}

/** Filesystem-backed blobs for MOCK_AWS mode and tests. URLs are API-relative. */
export class LocalBlobs implements Blobs {
  constructor(private dir: string) {}

  private p(key: string) {
    assertSafeKey(key);
    return path.join(this.dir, key);
  }

  async presignPut(key: string, contentType: string): Promise<PresignedPut> {
    assertSafeKey(key);
    return { url: `/mock/blob/${key}`, headers: { 'Content-Type': contentType } };
  }

  async presignGet(key: string): Promise<string> {
    assertSafeKey(key);
    return `/mock/blob/${key}`;
  }

  async head(key: string) {
    const f = this.p(key);
    return fs.existsSync(f) ? { size: fs.statSync(f).size } : null;
  }

  async getBytes(key: string, maxBytes: number) {
    const f = this.p(key);
    if (!fs.existsSync(f)) return null;
    if (fs.statSync(f).size > maxBytes) {
      fs.rmSync(f, { force: true });
      throw new ApiError(413, 'FILE_TOO_LARGE', 'That file is larger than 8 MB.', 'Upload a smaller photo or a one-page PDF.');
    }
    return new Uint8Array(fs.readFileSync(f));
  }

  async putBytes(key: string, bytes: Uint8Array) {
    const f = this.p(key);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, bytes);
  }

  async deletePrefix(prefix: string) {
    assertSafeKey(prefix.endsWith('/') ? prefix + 'x' : prefix);
    const root = path.join(this.dir, prefix);
    const target = fs.existsSync(root) && fs.statSync(root).isDirectory() ? root : null;
    if (target) {
      fs.rmSync(target, { recursive: true, force: true });
      return 1;
    }
    if (fs.existsSync(root)) {
      fs.rmSync(root, { force: true });
      return 1;
    }
    return 0;
  }
}

export function detectFileType(bytes: Uint8Array): 'png' | 'jpeg' | 'pdf' | null {
  if (bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  return null;
}
