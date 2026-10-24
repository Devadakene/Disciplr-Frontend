import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logger,
  configureLogger,
  resetLogger,
  scrub,
  scrubString,
  LOG_LEVEL_PRIORITY,
  type LogLevel,
  type LogMethod,
  type LogSink,
} from '../logger';

describe('logger – levels × methods matrix', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetLogger();
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetLogger();
    vi.restoreAllMocks();
  });

  const matrix: Array<{
    level: LogLevel;
    allowed: LogMethod[];
    suppressed: LogMethod[];
  }> = [
    {
      level: 'debug',
      allowed: ['debug', 'info', 'warn', 'error'],
      suppressed: [],
    },
    {
      level: 'info',
      allowed: ['info', 'warn', 'error'],
      suppressed: ['debug'],
    },
    {
      level: 'warn',
      allowed: ['warn', 'error'],
      suppressed: ['debug', 'info'],
    },
    {
      level: 'error',
      allowed: ['error'],
      suppressed: ['debug', 'info', 'warn'],
    },
    {
      level: 'silent',
      allowed: [],
      suppressed: ['debug', 'info', 'warn', 'error'],
    },
  ];

  matrix.forEach(({ level, allowed, suppressed }) => {
    it(`level "${level}" allows [${allowed.join(', ')}] and suppresses [${suppressed.join(', ')}]`, () => {
      configureLogger({ level });

      logger.debug('msg-debug');
      logger.info('msg-info');
      logger.warn('msg-warn');
      logger.error('msg-error');

      const spies: Record<LogMethod, ReturnType<typeof vi.spyOn>> = {
        debug: debugSpy,
        info: infoSpy,
        warn: warnSpy,
        error: errorSpy,
      };

      for (const m of allowed) {
        expect(spies[m]).toHaveBeenCalledWith(`msg-${m}`);
      }
      for (const m of suppressed) {
        expect(spies[m]).not.toHaveBeenCalled();
      }
    });
  });
});

describe('logger – production mode regression test', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetLogger();
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetLogger();
    vi.restoreAllMocks();
  });

  it('in simulated production configuration, debug/info/warn are silent and error logs', () => {
    // Simulating app bootstrap in production (level: import.meta.env.PROD ? 'error' : 'debug')
    configureLogger({ level: 'error' });

    logger.debug('[test] debug info');
    logger.info('[wallet-telemetry] connect event');
    logger.warn('[warning] unexpected state');
    logger.error('[error] payment failed');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[error] payment failed');
  });
});

describe('logger – scrubber cases', () => {
  const samplePubKey = 'G' + 'B'.repeat(51) + 'XYZ7'; // 56 chars
  const sampleSeed = 'S' + 'C'.repeat(51) + 'XYZ7'; // 56 chars

  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetLogger();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetLogger();
    vi.restoreAllMocks();
  });

  it('redacts Stellar public keys keeping the first 4 and last 4 characters', () => {
    const scrubbed = scrubString(`Address: ${samplePubKey}`);
    expect(scrubbed).toBe('Address: GBBB...XYZ7');
  });

  it('redacts Stellar secret seeds keeping the first 4 and last 4 characters', () => {
    const scrubbed = scrubString(`Seed: ${sampleSeed}`);
    expect(scrubbed).toBe('Seed: SCCC...XYZ7');
  });

  it('redacts address inside an Error message in every mode', () => {
    // Development mode
    configureLogger({ level: 'debug' });
    const devErr = new Error(`Transaction for ${samplePubKey} rejected`);
    logger.error('dev error', devErr);
    expect(errorSpy).toHaveBeenCalledWith('dev error', {
      name: 'Error',
      message: 'Transaction for GBBB...XYZ7 rejected',
      stack: expect.any(String),
    });

    // Production mode
    errorSpy.mockClear();
    configureLogger({ level: 'error' });
    const prodErr = new Error(`Transaction for ${samplePubKey} rejected`);
    logger.error('x', prodErr);
    expect(errorSpy).toHaveBeenCalledWith('x', {
      name: 'Error',
      message: 'Transaction for GBBB...XYZ7 rejected',
    });
  });

  it('satisfies acceptance criteria: logger.error("x", new Error("GABC...(56 chars)")) outputs redacted address in every mode', () => {
    const pubKey = 'GABC' + 'D'.repeat(48) + 'EFG2';
    expect(pubKey.length).toBe(56);

    // Verify in dev mode
    configureLogger({ level: 'debug' });
    logger.error('x', new Error(pubKey));
    let loggedErr = errorSpy.mock.calls[0][1] as any;
    expect(loggedErr.message).toBe('GABC...EFG2');

    // Verify in prod mode
    errorSpy.mockClear();
    configureLogger({ level: 'error' });
    logger.error('x', new Error(pubKey));
    loggedErr = errorSpy.mock.calls[0][1] as any;
    expect(loggedErr.message).toBe('GABC...EFG2');
  });

  it('scrubs nested objects without mutating caller objects', () => {
    const original = {
      user: {
        address: samplePubKey,
        nested: {
          seed: sampleSeed,
        },
      },
      count: 42,
    };

    const originalClone = JSON.parse(JSON.stringify(original));
    const result = scrub(original) as typeof original;

    // Caller object must not be mutated
    expect(original).toEqual(originalClone);

    // Scrubbed result contains redacted fields
    expect(result.user.address).toBe('GBBB...XYZ7');
    expect(result.user.nested.seed).toBe('SCCC...XYZ7');
    expect(result.count).toBe(42);
  });

  it('handles circular references without hanging', () => {
    const circularObj: any = { name: 'cycle' };
    circularObj.self = circularObj;

    expect(() => scrub(circularObj)).not.toThrow();
    const result = scrub(circularObj) as any;
    expect(result.name).toBe('cycle');
    expect(result.self).toBe('[Circular]');
  });

  it('bounds traversal at depth 4 and 50 keys', () => {
    // Deeply nested object beyond depth 4
    const deepObj = {
      l1: {
        l2: {
          l3: {
            l4: {
              l5: {
                address: samplePubKey,
              },
            },
          },
        },
      },
    };

    const result = scrub(deepObj) as any;
    expect(result).toBeDefined();

    // Large object with > 50 keys
    const largeObj: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) {
      largeObj[`key_${i}`] = i < 30 ? samplePubKey : 'plain_val';
    }

    expect(() => scrub(largeObj)).not.toThrow();
    const largeResult = scrub(largeObj) as any;
    expect(largeResult.key_0).toBe('GBBB...XYZ7');
  });

  it('preserves non-string arguments unchanged', () => {
    expect(scrub(123)).toBe(123);
    expect(scrub(true)).toBe(true);
    expect(scrub(false)).toBe(false);
    expect(scrub(null)).toBe(null);
    expect(scrub(undefined)).toBe(undefined);

    const fn = () => 'test';
    expect(scrub(fn)).toBe(fn);

    const sym = Symbol('sym');
    expect(scrub(sym)).toBe(sym);
  });

  it('redacts 64-hex transaction hashes when marked sensitive', () => {
    const hash = 'a'.repeat(64);
    const objWithSensitive = {
      sensitive: true,
      txHash: hash,
    };

    const result = scrub(objWithSensitive) as any;
    expect(result.txHash).toBe('aaaa...aaaa');

    // Without sensitive: true, hash is untouched
    const normalObj = {
      txHash: hash,
    };
    const normalResult = scrub(normalObj) as any;
    expect(normalResult.txHash).toBe(hash);
  });

  it('supports custom pluggable sink', () => {
    const customSink = vi.fn();
    configureLogger({ level: 'debug', sink: customSink });

    logger.info('telemetry', { address: samplePubKey });
    expect(customSink).toHaveBeenCalledWith('info', 'telemetry', {
      address: 'GBBB...XYZ7',
    });
  });
});

describe('eslint configuration for logger and console', () => {
  it('asserts that no-console rule is configured for src/** with overrides', async () => {
    const eslintConfig = (await import('../../../eslint.config.js')).default;
    const noConsoleBlock = eslintConfig.find(
      (c: any) =>
        Array.isArray(c.files) &&
        c.files.some((f: string) => f.includes('src/')) &&
        c.rules?.['no-console'] === 'error'
    );
    expect(noConsoleBlock).toBeDefined();

    const overrideBlock = eslintConfig.find(
      (c: any) =>
        Array.isArray(c.files) &&
        c.files.some((f: string) => f.includes('src/utils/logger.ts')) &&
        c.rules?.['no-console'] === 'off'
    );
    expect(overrideBlock).toBeDefined();
  });
});
