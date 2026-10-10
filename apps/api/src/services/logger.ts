import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import type { Config } from '../config';

export type Log = Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;

export function createLogger(cfg: Pick<Config, 'logLevel'>): Log {
  return new Logger({
    serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'chhatready-api',
    logLevel: (cfg.logLevel as 'INFO') || 'INFO'
  });
}

export interface MetricsLike {
  count(name: string): void;
}

/** CloudWatch EMF metrics inside Lambda; a no-op locally and in tests. */
export function createMetrics(enabled: boolean): MetricsLike {
  if (!enabled) return { count() {} };
  const m = new Metrics({ namespace: 'ChhatReady', serviceName: 'chhatready-api' });
  return {
    count(name) {
      m.addMetric(name, MetricUnit.Count, 1);
      m.publishStoredMetrics();
    }
  };
}

export const silentLog: Log = { info() {}, warn() {}, error() {}, debug() {} };
export const noMetrics: MetricsLike = { count() {} };
