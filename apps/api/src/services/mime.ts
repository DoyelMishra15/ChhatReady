import { randomBytes } from 'node:crypto';

const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

function encodeHeader(s: string): string {
  const v = clean(s);
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;
}

const wrap76 = (b64: string) => b64.replace(/(.{76})/g, '$1\r\n');

export interface MimeInput {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachment?: { filename: string; contentType: string; bytes: Uint8Array };
}

/** Builds a standards-compliant MIME message. All header values are stripped of CR/LF (no header injection). */
export function buildMime(m: MimeInput): string {
  const boundary = `chhatready_${randomBytes(12).toString('hex')}`;
  const headers = [
    `From: ${clean(m.from)}`,
    `To: ${clean(m.to)}`,
    m.replyTo ? `Reply-To: ${clean(m.replyTo)}` : '',
    `Subject: ${encodeHeader(m.subject)}`,
    'MIME-Version: 1.0'
  ].filter(Boolean);

  const textPart = [
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(m.text, 'utf8').toString('base64'))
  ].join('\r\n');

  if (!m.attachment) {
    return [...headers, textPart].join('\r\n');
  }
  const a = m.attachment;
  const fname = a.filename.replace(/[^A-Za-z0-9._-]/g, '_');
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    textPart,
    `--${boundary}`,
    `Content-Type: ${a.contentType}; name="${fname}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${fname}"`,
    '',
    wrap76(Buffer.from(a.bytes).toString('base64')),
    `--${boundary}--`,
    ''
  ].join('\r\n');
}
