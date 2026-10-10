import fs from 'node:fs';
import path from 'node:path';
import { SendEmailCommand, type SESv2Client } from '@aws-sdk/client-sesv2';
import { ApiError } from '../errors';
import { buildMime } from './mime';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachment?: { filename: string; contentType: string; bytes: Uint8Array };
}

export interface Mailer {
  readonly mode: 'ses' | 'file';
  send(m: MailMessage): Promise<{ id: string }>;
}

export class SesMailer implements Mailer {
  readonly mode = 'ses' as const;
  constructor(
    private ses: SESv2Client,
    private from: string
  ) {}

  async send(m: MailMessage) {
    if (!this.from)
      throw new ApiError(503, 'SES_NOT_CONFIGURED', 'Email sending is not configured on this deployment.', 'Set SES_FROM to a verified sender address.');
    const raw = Buffer.from(buildMime({ from: this.from, ...m }));
    try {
      const r = await this.ses.send(new SendEmailCommand({ FromEmailAddress: this.from, Destination: { ToAddresses: [m.to] }, Content: { Raw: { Data: raw } } }), {
        abortSignal: AbortSignal.timeout(10_000)
      });
      return { id: r.MessageId ?? 'unknown' };
    } catch (e) {
      const name = (e as { name?: string }).name ?? '';
      if (name === 'MessageRejected' || name === 'MailFromDomainNotVerifiedException')
        throw new ApiError(
          502,
          'SES_NOT_READY',
          'The email provider rejected this message.',
          'If SES is still in sandbox mode it can only send to verified addresses. Use the copy or mailto options instead.'
        );
      if (name === 'TimeoutError' || name === 'AbortError')
        throw new ApiError(504, 'SES_TIMEOUT', 'Email sending timed out.', 'Please try again.');
      throw new ApiError(502, 'SES_FAILED', 'Email could not be sent right now.', 'Please try again, or use the copy or mailto options.');
    }
  }
}

/** Writes .eml files to <dataDir>/outbox. Used in MOCK_AWS mode so the flow is demonstrable without SES. */
export class FileMailer implements Mailer {
  readonly mode = 'file' as const;
  private n = 0;
  constructor(
    private dir: string,
    private from = 'ChhatReady <no-reply@chhatready.local>'
  ) {}

  async send(m: MailMessage) {
    fs.mkdirSync(this.dir, { recursive: true });
    const id = `${Date.now()}-${++this.n}`;
    fs.writeFileSync(path.join(this.dir, `${id}.eml`), buildMime({ from: this.from, ...m }));
    return { id };
  }
}
