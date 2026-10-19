import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Re-import logger fresh each time so MODE change takes effect.
async function freshLogger() {
  vi.resetModules();
  const mod = await import('../logger');
  return mod.logger;
}

describe('logger – development mode', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('forwards debug in dev', async () => {
    const log = await freshLogger();
    log.debug('dbg msg', 42);
    expect(console.debug).toHaveBeenCalledWith('dbg msg', 42);
  });

  it('forwards info in dev', async () => {
    const log = await freshLogger();
    log.info('info msg');
    expect(console.info).toHaveBeenCalledWith('info msg');
  });

  it('forwards warn in dev', async () => {
    const log = await freshLogger();
    log.warn('warn msg');
    expect(console.warn).toHaveBeenCalledWith('warn msg');
  });

  it('forwards error in dev', async () => {
    const log = await freshLogger();
    log.error('err msg', new Error('boom'));
    expect(console.error).toHaveBeenCalledWith('err msg', new Error('boom'));
  });
});

describe('logger – production mode', () => {
  beforeEach(() => {
    // import.meta.env.MODE is inlined by Vite's transform pipeline and does
    // not reliably reflect vi.stubEnv('MODE', ...) once a module has already
    // been transformed under 'test' mode earlier in the run (a known
    // Vite/Vitest limitation). The logger's Node fallback path checks
    // process.env.NODE_ENV, which vi.stubEnv patches on a genuinely live,
    // mutable object, so stub that instead to reliably exercise prod mode.
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('suppresses debug in prod', async () => {
    const log = await freshLogger();
    log.debug('should not appear');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('suppresses info in prod', async () => {
    const log = await freshLogger();
    log.info('should not appear');
    expect(console.info).not.toHaveBeenCalled();
  });

  it('suppresses warn in prod', async () => {
    const log = await freshLogger();
    log.warn('should not appear');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('still forwards error in prod', async () => {
    const log = await freshLogger();
    log.error('critical', new Error('fatal'));
    expect(console.error).toHaveBeenCalledWith('critical', new Error('fatal'));
  });
});

describe('logger – argument types', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('passes Error instance through to console.error', async () => {
    const log = await freshLogger();
    const err = new Error('test error');
    log.error('context label', err);
    expect(console.error).toHaveBeenCalledWith('context label', err);
  });

  it('passes plain string through to console.warn', async () => {
    const log = await freshLogger();
    log.warn('string warning');
    expect(console.warn).toHaveBeenCalledWith('string warning');
  });
});
