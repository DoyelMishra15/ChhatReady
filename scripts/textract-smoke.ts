// Calls the REAL Amazon Textract on the sample bill and prints what was read.
// Needs AWS credentials. Usage: npm run smoke:textract [path-to-bill.png|jpg|pdf]
import { TextractClient } from '@aws-sdk/client-textract';
import { readFileSync } from 'node:fs';
import { TextractExtractor } from '../apps/api/src/services/textract';

const file = process.argv[2] ?? 'apps/web/public/demo/sample-bill.png';
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const bytes = new Uint8Array(readFileSync(file));
console.log(`Textract smoke test: ${file}, region ${region}`);
try {
  const out = await new TextractExtractor(new TextractClient({ region })).extractBill(bytes);
  console.log(JSON.stringify(out, null, 2));
  console.log('\nOK. Compare the values above with the bill image.');
} catch (e) {
  console.error('FAILED:', e instanceof Error ? `${e.name}: ${e.message}` : e);
  console.error('Check AWS credentials, that Textract is available in this region, and set AWS_REGION if needed.');
  process.exit(1);
}
