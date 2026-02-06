import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

export type LogLevelName = 'debug' | 'info' | 'warn' | 'error' | 'off';

const LOG_LEVEL_ORDER: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  off: 100
};

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private readonly level: number;

  constructor() {
    const configuredLevel = (environment as unknown as { logLevel?: LogLevelName }).logLevel;
    const configuredTestLevel = (environment as unknown as { testLogLevel?: LogLevelName }).testLogLevel;

    const isKarma =
      typeof window !== 'undefined' &&
      typeof (window as unknown as { __karma__?: unknown }).__karma__ !== 'undefined';

    const defaultNonTestLevel: LogLevelName = environment.production ? 'warn' : 'debug';
    const chosen: LogLevelName = isKarma
      ? (configuredTestLevel ?? 'warn')
      : (configuredLevel ?? defaultNonTestLevel);

    const fallback: LogLevelName = isKarma ? 'warn' : defaultNonTestLevel;
    this.level = LOG_LEVEL_ORDER[chosen] ?? LOG_LEVEL_ORDER[fallback];
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVEL_ORDER.debug) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVEL_ORDER.info) {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVEL_ORDER.warn) {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVEL_ORDER.error) {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}
