import path from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { TextractClient } from '@aws-sdk/client-textract';
import { loadConfig, type Config } from './config';
import { LocalBlobs, S3Blobs } from './services/blobs';
import { createLogger, createMetrics } from './services/logger';
import { FileMailer, SesMailer } from './services/mailer';
import { DdbStore, MemoryStore } from './services/store';
import { MockExtractor, SampleFallbackExtractor, TextractExtractor } from './services/textract';
import { createYieldService } from './services/yields';
import type { Deps } from './types';

export function buildDeps(cfg: Config = loadConfig()): Deps {
  const log = createLogger(cfg);
  const inLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  const metrics = createMetrics(inLambda);

  if (cfg.mock) {
    const store = new MemoryStore(path.join(cfg.dataDir, 'store.json'));
    log.info('Running in MOCK_AWS mode: local files stand in for S3, DynamoDB, Textract and SES.');
    return {
      cfg,
      store,
      blobs: new LocalBlobs(path.join(cfg.dataDir, 'blobs')),
      extractor: new MockExtractor(),
      mailer: new FileMailer(path.join(cfg.dataDir, 'outbox')),
      yields: createYieldService({ store, pvgisBase: cfg.pvgisBase, mock: true }),
      log,
      metrics,
      now: () => new Date()
    };
  }

  const region = cfg.region;
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });
  const store = new DdbStore(doc, cfg.tableName);
  return {
    cfg,
    store,
    blobs: new S3Blobs(new S3Client({ region }), cfg.uploadBucket),
    extractor: new SampleFallbackExtractor(new TextractExtractor(new TextractClient({ region }))),
    mailer: new SesMailer(new SESv2Client({ region }), cfg.sesFrom),
    yields: createYieldService({ store, pvgisBase: cfg.pvgisBase, mock: false }),
    log,
    metrics,
    now: () => new Date()
  };
}
