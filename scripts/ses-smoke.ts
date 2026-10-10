// Sends ONE real test email through Amazon SES using your SES_FROM sender.
// Usage: SES_FROM=you@example.com npm run smoke:ses -- recipient@example.com
// In the SES sandbox, the recipient must also be a verified address.
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { SesMailer } from '../apps/api/src/services/mailer';

const from = process.env.SES_FROM;
const to = process.argv[2];
if (!from || !to) {
  console.error('Usage: SES_FROM=verified@sender.example npm run smoke:ses -- recipient@example.com');
  process.exit(2);
}
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
try {
  const r = await new SesMailer(new SESv2Client({ region }), from).send({ to, subject: 'ChhatReady SES test', text: 'If you can read this, SES is configured correctly.' });
  console.log(`Sent. Message id ${r.id}`);
} catch (e) {
  console.error('FAILED:', e instanceof Error ? `${e.name}: ${e.message}` : e);
  console.error('Is the sender verified in this region? In the sandbox the recipient must be verified too.');
  process.exit(1);
}
