import fs from 'node:fs';
import path from 'node:path';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

export type Item = Record<string, unknown> & { pk: string; sk: string };

export interface Store {
  get<T extends object>(pk: string, sk: string): Promise<(T & { pk: string; sk: string }) | null>;
  put(pk: string, sk: string, data: object, ttlSeconds?: number): Promise<void>;
  query<T extends object>(pk: string, skPrefix?: string): Promise<(T & { pk: string; sk: string })[]>;
  delete(pk: string, sk: string): Promise<void>;
  deleteAll(pk: string): Promise<number>;
}

const nowSec = () => Math.floor(Date.now() / 1000);

export class DdbStore implements Store {
  constructor(
    private doc: DynamoDBDocumentClient,
    private table: string
  ) {}

  // DynamoDB TTL removes items lazily (up to a couple of days late), so expired items are ignored here.
  private alive(item: Record<string, unknown> | undefined) {
    const ttl = item?.ttl as number | undefined;
    return item && !(ttl && ttl < nowSec()) ? item : undefined;
  }

  async get<T extends object>(pk: string, sk: string) {
    const r = await this.doc.send(new GetCommand({ TableName: this.table, Key: { pk, sk } }));
    return (this.alive(r.Item) as (T & { pk: string; sk: string }) | undefined) ?? null;
  }

  async put(pk: string, sk: string, data: object, ttlSeconds?: number) {
    const item: Record<string, unknown> = { ...data, pk, sk };
    if (ttlSeconds) item.ttl = nowSec() + ttlSeconds;
    await this.doc.send(new PutCommand({ TableName: this.table, Item: item }));
  }

  async query<T extends object>(pk: string, skPrefix?: string) {
    const out: (T & { pk: string; sk: string })[] = [];
    let key: Record<string, unknown> | undefined;
    do {
      const r = await this.doc.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: skPrefix ? 'pk = :pk AND begins_with(sk, :p)' : 'pk = :pk',
          ExpressionAttributeValues: skPrefix ? { ':pk': pk, ':p': skPrefix } : { ':pk': pk },
          ExclusiveStartKey: key
        })
      );
      out.push(...((r.Items ?? []).filter((i) => this.alive(i)) as (T & { pk: string; sk: string })[]));
      key = r.LastEvaluatedKey;
    } while (key);
    return out;
  }

  async delete(pk: string, sk: string) {
    await this.doc.send(new DeleteCommand({ TableName: this.table, Key: { pk, sk } }));
  }

  async deleteAll(pk: string) {
    const items = await this.query(pk);
    for (const it of items) await this.delete(it.pk, it.sk);
    return items.length;
  }
}

/** In-memory store for tests and MOCK_AWS mode. Persists to a JSON file when a path is given. */
export class MemoryStore implements Store {
  private data = new Map<string, Record<string, unknown>>();

  constructor(private file?: string) {
    if (file && fs.existsSync(file)) {
      try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Record<string, unknown>>;
        for (const [k, v] of Object.entries(raw)) this.data.set(k, v);
      } catch {
        /* start fresh on a corrupt file */
      }
    }
  }

  private k(pk: string, sk: string) {
    return `${pk}\u0000${sk}`;
  }

  private persist() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.data)));
  }

  private live(item: Record<string, unknown> | undefined) {
    if (!item) return null;
    const ttl = item.ttl as number | undefined;
    if (ttl && ttl < nowSec()) return null;
    return item;
  }

  async get<T extends object>(pk: string, sk: string) {
    return this.live(this.data.get(this.k(pk, sk))) as (T & { pk: string; sk: string }) | null;
  }

  async put(pk: string, sk: string, data: object, ttlSeconds?: number) {
    const item: Record<string, unknown> = { ...JSON.parse(JSON.stringify(data)), pk, sk };
    if (ttlSeconds) item.ttl = nowSec() + ttlSeconds;
    this.data.set(this.k(pk, sk), item);
    this.persist();
  }

  async query<T extends object>(pk: string, skPrefix?: string) {
    const out: (T & { pk: string; sk: string })[] = [];
    for (const item of this.data.values()) {
      if (item.pk !== pk || !this.live(item)) continue;
      if (skPrefix && !(item.sk as string).startsWith(skPrefix)) continue;
      out.push(item as T & { pk: string; sk: string });
    }
    return out.sort((a, b) => a.sk.localeCompare(b.sk));
  }

  async delete(pk: string, sk: string) {
    this.data.delete(this.k(pk, sk));
    this.persist();
  }

  async deleteAll(pk: string) {
    let n = 0;
    for (const [key, item] of [...this.data.entries()]) {
      if (item.pk === pk) {
        this.data.delete(key);
        n++;
      }
    }
    this.persist();
    return n;
  }
}
