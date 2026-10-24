/**
 * Canonical runtime-agnostic logger shared by the design-system and app.
 *
 * Configurable with a threshold log level (debug < info < warn < error < silent)
 * and an optional custom sink. Vite apps configure this statically in main.tsx
 * using import.meta.env.PROD, while Node/Jest environments default according
 * to process.env.NODE_ENV.
 *
 * All logged arguments pass through a central bounded scrubber that redacts
 * Stellar public keys and secret seeds, and reduces Error instances to safe
 * representations before reaching any sink.
 */

export type LogMethod = 'debug' | 'info' | 'warn' | 'error';
export type LogLevel = LogMethod | 'silent';

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export type LogSinkFn = (level: LogMethod, ...args: unknown[]) => void;

export interface LogSinkObj {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

export type LogSink = LogSinkFn | LogSinkObj;

export interface LoggerOptions {
  level?: LogLevel;
  sink?: LogSink;
}

let configuredLevel: LogLevel | undefined;
let configuredSink: LogSink | undefined;

export const configureLogger = (options?: LoggerOptions): void => {
  if (!options) return;
  if (options.level !== undefined) {
    configuredLevel = options.level;
  }
  if (options.sink !== undefined) {
    configuredSink = options.sink;
  }
};

export const resetLogger = (): void => {
  configuredLevel = undefined;
  configuredSink = undefined;
};

const getDefaultLevel = (): LogLevel => {
  const nodeProcess = (globalThis as any).process;
  if (
    typeof nodeProcess !== 'undefined' &&
    nodeProcess?.env?.NODE_ENV === 'production'
  ) {
    return 'error';
  }
  return 'debug';
};

export const getEffectiveLevel = (): LogLevel => {
  return configuredLevel ?? getDefaultLevel();
};

export const isProd = (): boolean => {
  const level = getEffectiveLevel();
  return level === 'error' || level === 'silent';
};

// Stellar public key (G...) and secret seed (S...), RFC4648 Base32 alphabet, 56 characters total.
const STELLAR_KEY_REGEX = /([GS][A-Z2-7]{3})[A-Z2-7]{48}([A-Z2-7]{4})/g;

export function scrubString(str: string): string {
  return str.replace(STELLAR_KEY_REGEX, '$1...$2');
}

export function scrub(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
  keyCountRef = { count: 0 }
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return scrubString(value);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    const isDev = getEffectiveLevel() === 'debug';
    const scrubbedMessage = typeof value.message === 'string' ? scrubString(value.message) : '';
    const proto = Object.getPrototypeOf(value);
    const reduced: any = Object.create(proto);
    reduced.name = value.name || 'Error';
    reduced.message = scrubbedMessage;
    if (isDev && typeof value.stack === 'string') {
      reduced.stack = scrubString(value.stack);
    }
    return reduced;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (depth >= 4 || keyCountRef.count >= 50) {
    return value;
  }

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      if (keyCountRef.count >= 50) {
        result.push(value[i]);
      } else {
        keyCountRef.count++;
        result.push(scrub(value[i], depth + 1, seen, keyCountRef));
      }
    }
    return result;
  }

  const result: Record<string, unknown> = {};
  const isObjSensitive = (value as Record<string, unknown>).sensitive === true;
  for (const key of Object.keys(value)) {
    if (keyCountRef.count >= 50) {
      result[key] = (value as Record<string, unknown>)[key];
    } else {
      keyCountRef.count++;
      let val = (value as Record<string, unknown>)[key];
      if (isObjSensitive && typeof val === 'string' && /^[0-9a-fA-F]{64}$/.test(val)) {
        val = val.slice(0, 4) + '...' + val.slice(-4);
      }
      result[key] = scrub(val, depth + 1, seen, keyCountRef);
    }
  }
  return result;
}

/* eslint-disable no-console */
const defaultSink: LogSinkObj = {
  debug: (...args: unknown[]) => console.debug(...args),
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

const emit = (level: LogMethod, args: unknown[]): void => {
  const currentLevel = getEffectiveLevel();
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[currentLevel]) {
    return;
  }

  const scrubbedArgs = args.map((arg) => scrub(arg));
  const sink = configuredSink ?? defaultSink;

  if (typeof sink === 'function') {
    sink(level, ...scrubbedArgs);
  } else if (sink && typeof sink[level] === 'function') {
    sink[level]!(...scrubbedArgs);
  }
};

export const logger = {
  debug: (...args: unknown[]): void => emit('debug', args),
  info: (...args: unknown[]): void => emit('info', args),
  warn: (...args: unknown[]): void => emit('warn', args),
  error: (...args: unknown[]): void => emit('error', args),
};
/* eslint-enable no-console */
