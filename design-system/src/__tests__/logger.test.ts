import {
  logger,
  configureLogger,
  resetLogger,
  scrub,
  scrubString,
  LOG_LEVEL_PRIORITY,
  type LogLevel,
  type LogSink,
} from '../utils/logger';

describe('design-system logger', () => {
  const originalEnv = process.env.NODE_ENV;
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    resetLogger();
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
    resetLogger();
  });

  describe('non-production routing', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('routes debug to console.debug', () => {
      logger.debug('hello');
      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith('hello');
    });

    it('routes info to console.info', () => {
      logger.info('hi');
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith('hi');
    });

    it('routes warn to console.warn', () => {
      logger.warn('careful');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('careful');
    });

    it('routes error to console.error', () => {
      logger.error('boom');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('boom');
    });

    it('forwards metadata/object arguments unchanged', () => {
      const meta = { file: 'colors.json', count: 3 };
      logger.warn('Failed to load:', meta);
      expect(warnSpy).toHaveBeenCalledWith('Failed to load:', meta);
    });

    it('supports a no-argument call without throwing', () => {
      expect(() => logger.info()).not.toThrow();
      expect(infoSpy).toHaveBeenCalledWith();
    });
  });

  describe('production level gating via NODE_ENV', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('suppresses debug, info, and warn', () => {
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('still emits error in production', () => {
      logger.error('critical', { code: 500 });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('critical', { code: 500 });
    });

    it('does not throw when process is unavailable', () => {
      const globalWithProcess = global as any;
      const originalProcess = globalWithProcess.process;

      globalWithProcess.process = undefined;

      try {
        expect(() => logger.debug('hello')).not.toThrow();
      } finally {
        globalWithProcess.process = originalProcess;
      }
    });
  });

  describe('configureLogger API', () => {
    it('allows configuring threshold log levels', () => {
      configureLogger({ level: 'warn' });
      logger.debug('suppressed debug');
      logger.info('suppressed info');
      logger.warn('active warn');
      logger.error('active error');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('active warn');
      expect(errorSpy).toHaveBeenCalledWith('active error');
    });

    it('supports silent level suppressing all outputs', () => {
      configureLogger({ level: 'silent' });
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('supports custom function sink', () => {
      const customSink = jest.fn();
      configureLogger({ level: 'debug', sink: customSink });

      logger.info('event', { key: 'val' });
      expect(customSink).toHaveBeenCalledWith('info', 'event', { key: 'val' });
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('supports custom object sink', () => {
      const customSink: LogSink = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      configureLogger({ level: 'debug', sink: customSink });

      logger.warn('caution', 123);
      expect(customSink.warn).toHaveBeenCalledWith('caution', 123);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('scrubbing in design-system', () => {
    it('redacts Stellar public keys keeping first 4 and last 4 characters', () => {
      const pubKey = 'G' + 'A'.repeat(51) + 'XYZ2';
      expect(pubKey.length).toBe(56);
      expect(scrubString(pubKey)).toBe('GAAA...XYZ2');
    });

    it('redacts Stellar secret seeds', () => {
      const seed = 'S' + 'A'.repeat(51) + 'XYZ2';
      expect(seed.length).toBe(56);
      expect(scrubString(seed)).toBe('SAAA...XYZ2');
    });

    it('reduces Error instances safely without leaking unredacted keys', () => {
      configureLogger({ level: 'error' });
      const pubKey = 'G' + 'A'.repeat(51) + 'XYZ2';
      const err = new Error(`Connection failed for ${pubKey}`);
      logger.error('failed', err);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const loggedError = errorSpy.mock.calls[0][1];
      expect(loggedError.name).toBe('Error');
      expect(loggedError.message).toBe('Connection failed for GAAA...XYZ2');
      expect(loggedError.stack).toBeUndefined(); // dev-only
    });
  });
});
