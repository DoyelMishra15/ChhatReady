import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { ChhatReadyStack } from '../lib/chhatready-stack';

let t: Template;

beforeAll(() => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'chhatready-dist-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<html></html>');
  const app = new cdk.App({ outdir: fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-out-')) });
  const stack = new ChhatReadyStack(app, 'Test', {
    webDistDir: dist,
    sesFrom: 'ChhatReady <me@example.com>',
    env: { account: '123456789012', region: 'ap-south-1' }
  });
  t = Template.fromStack(stack);
}, 60_000);

describe('ChhatReady stack', () => {
  it('has one on-demand DynamoDB table with TTL', () => {
    t.resourceCountIs('AWS::DynamoDB::Table', 1);
    t.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, { AttributeName: 'sk', KeyType: 'RANGE' }]
    });
  });

  it('keeps uploads private and expires them quickly', () => {
    t.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({ Id: 'expire-uploads-1d', ExpirationInDays: 1, Prefix: 'uploads/' }),
          Match.objectLike({ Id: 'expire-packs-7d', ExpirationInDays: 7, Prefix: 'packs/' })
        ])
      }
    });
  });

  it('runs the API on Node 22 / arm64 with the right environment', () => {
    t.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      Timeout: 30,
      Environment: { Variables: Match.objectLike({ MOCK_AWS: '0', SES_FROM: 'ChhatReady <me@example.com>', CASE_TTL_DAYS: '30' }) }
    });
  });

  it('grants Textract and SES, and nothing like a wildcard action', () => {
    const policies = t.findResources('AWS::IAM::Policy');
    const statements = Object.values(policies).flatMap((p) => (p as { Properties: { PolicyDocument: { Statement: { Action: string | string[]; Resource: unknown }[] } } }).Properties.PolicyDocument.Statement);
    const actions = statements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));
    expect(actions).toEqual(expect.arrayContaining(['textract:AnalyzeDocument', 'textract:DetectDocumentText', 'ses:SendEmail']));
    expect(actions).not.toContain('*');
    expect(actions.filter((a) => a.endsWith(':*'))).toEqual([]);
  });

  it('exposes the API through an HTTP API with throttling', () => {
    t.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    t.hasResourceProperties('AWS::ApiGatewayV2::Stage', { DefaultRouteSettings: { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 } });
  });

  it('serves the SPA through CloudFront over HTTPS with a deep-link fallback', () => {
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
        CustomErrorResponses: Match.arrayWith([Match.objectLike({ ErrorCode: 404, ResponsePagePath: '/index.html', ResponseCode: 200 })])
      })
    });
  });

  it('keeps logs for two weeks and exports useful outputs', () => {
    t.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 14 });
    const out = t.findOutputs('*');
    expect(Object.keys(out)).toEqual(expect.arrayContaining(['SiteUrl', 'ApiUrl', 'TableName', 'UploadBucket']));
  });
});
