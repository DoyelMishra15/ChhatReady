export interface Config {
  mock: boolean;
  region: string;
  tableName: string;
  uploadBucket: string;
  sesFrom: string;
  allowedOrigins: string[];
  appUrl: string;
  caseTtlDays: number;
  pvgisBase: string;
  dataDir: string;
  logLevel: string;
  maxEmailsPerCase: number;
  maxRfqPerCase: number;
  maxUploadBytes: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const mock = env.MOCK_AWS === '1' || env.MOCK_AWS === 'true';
  const cfg: Config = {
    mock,
    region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'ap-south-1',
    tableName: env.TABLE_NAME || '',
    uploadBucket: env.UPLOAD_BUCKET || '',
    sesFrom: env.SES_FROM || '',
    allowedOrigins: (env.ALLOWED_ORIGIN || '*')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    appUrl: (env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
    caseTtlDays: Number(env.CASE_TTL_DAYS || 30),
    pvgisBase: (env.PVGIS_BASE || 'https://re.jrc.ec.europa.eu/api/v5_2').replace(/\/$/, ''),
    dataDir: env.DATA_DIR || '.data',
    logLevel: env.LOG_LEVEL || 'INFO',
    maxEmailsPerCase: Number(env.MAX_EMAILS_PER_CASE || 10),
    maxRfqPerCase: Number(env.MAX_RFQ_PER_CASE || 5),
    maxUploadBytes: 8 * 1024 * 1024
  };
  if (!mock) {
    const missing = [
      ['TABLE_NAME', cfg.tableName],
      ['UPLOAD_BUCKET', cfg.uploadBucket]
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length)
      throw new Error(
        `Missing environment variables: ${missing.join(', ')}. Set them, or run with MOCK_AWS=1 for local mock mode.`
      );
  }
  return cfg;
}
