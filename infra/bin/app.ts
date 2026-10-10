import fs from 'node:fs';
import path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { ChhatReadyStack, REPO_ROOT } from '../lib/chhatready-stack';

const app = new cdk.App();
const webDistDir = path.join(REPO_ROOT, 'apps', 'web', 'dist');
if (!fs.existsSync(path.join(webDistDir, 'index.html'))) {
  throw new Error('Web app is not built yet. Run `npm run build:web` first (or use `npm run deploy` which builds it).');
}

new ChhatReadyStack(app, 'ChhatReady', {
  webDistDir,
  sesFrom: process.env.SES_FROM ?? app.node.tryGetContext('sesFrom') ?? '',
  extraOrigins: process.env.EXTRA_ORIGINS ?? app.node.tryGetContext('extraOrigins') ?? '',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1'
  }
});
