/**
 * Focused tests for design-system/src/utils/token-loader.ts
 *
 * Coverage contract:
 *   loadTokens   — basename validation, path-traversal guard, FS error pass-through,
 *                  malformed JSON, successful parse
 *   getAllTokens  — happy-path merge of all 10 built-in files, partial failure
 *                  (one file missing, one malformed, first / last file failing),
 *                  all-fail returns empty object, warn message includes filename,
 *                  later-file key wins (Object.assign ordering)
 *   getTokenValue — empty path, missing top-level key, nested missing segment,
 *                   raw node returned when no $value, DTCG leaf node ($value),
 *                   mode-aware resolution (light / dark), non-object mid-path,
 *                   node is null mid-path
 */

import { loadTokens, getAllTokens, getTokenValue } from '../utils/token-loader';
import * as fs from 'fs';

jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// ── helpers ────────────────────────────────────────────────────────────────

/** Returns an fs mock that returns `json` for every file path. */
const alwaysReturn = (json: string) =>
  mockedFs.readFileSync.mockReturnValue(json as any);

/** Builds a full 10-file mock implementation.
 *  Pass `overrides` to replace the response for specific filenames. */
const tenFileMock = (
  overrides: Record<string, string | (() => never)> = {},
) => {
  const defaults: Record<string, string> = {
    'colors.json':      '{"color":"red"}',
    'typography.json':  '{"font":"sans"}',
    'spacing.json':     '{"space":"4px"}',
    'shadows.json':     '{"shadow":"1px"}',
    'motion.json':      '{"motion":"ease"}',
    'borders.json':     '{"border":"1px"}',
    'z-index.json':     '{"zIndex":100}',
    'opacity.json':     '{"opacity":0.5}',
    'breakpoints.json': '{"breakpoint":"768px"}',
    'toast.json':       '{"toast":{"maxVisible":5}}',
  };

  mockedFs.readFileSync.mockImplementation((filePath) => {
    const name = String(filePath).split(/[\\/]/).pop()!;
    if (name in overrides) {
      const override = overrides[name];
      if (typeof override === 'function') return override();
      return override as any;
    }
    return (defaults[name] ?? '{}') as any;
  });
};

// ── loadTokens ─────────────────────────────────────────────────────────────

describe('loadTokens', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── success path ──────────────────────────────────────────────────────────

  it('parses valid JSON and returns the token object', () => {
    alwaysReturn('{"color":{"primary":"red"}}');
    expect(loadTokens('colors.json')).toEqual({ color: { primary: 'red' } });
  });

  it('accepts any valid basename with .json extension', () => {
    alwaysReturn('{"x":1}');
    expect(() => loadTokens('my-tokens_v2.json')).not.toThrow();
  });

  // ── basename validation (Guard 1) ─────────────────────────────────────────

  it.each([
    '../etc/passwd',
    '../../etc/shadow',
    '/etc/passwd',
    'sub/colors.json',
    'sub\\colors.json',
    'colors.json/../../etc/passwd',
    '..\\windows\\system32\\config\\sam',
  ])('rejects path with separators: %s', (input) => {
    expect(() => loadTokens(input)).toThrow(/Invalid token file name/);
    expect(mockedFs.readFileSync).not.toHaveBeenCalled();
  });

  it.each([
    'colors',         // no extension
    'colors.txt',     // wrong extension
    '',               // empty string — fails regex (no characters before .json)
  ])('rejects non-.json or empty name: %s', (input) => {
    expect(() => loadTokens(input)).toThrow();
    expect(mockedFs.readFileSync).not.toHaveBeenCalled();
  });

  // Absolute path is rejected by the separator guard before the FS is touched.
  it('rejects absolute paths before touching the filesystem', () => {
    expect(() => loadTokens('/etc/passwd.json')).toThrow();
    expect(mockedFs.readFileSync).not.toHaveBeenCalled();
  });

  // ── FS error pass-through ─────────────────────────────────────────────────

  it('re-throws ENOENT when file does not exist', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      const e = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
      throw e;
    });
    expect(() => loadTokens('missing.json')).toThrow(/ENOENT/);
  });

  // ── JSON parse failure ────────────────────────────────────────────────────

  it('throws SyntaxError for malformed JSON', () => {
    alwaysReturn('{"invalid":}');
    expect(() => loadTokens('broken.json')).toThrow(SyntaxError);
  });

  it('throws SyntaxError for completely empty file content', () => {
    alwaysReturn('');
    expect(() => loadTokens('empty.json')).toThrow(SyntaxError);
  });
});

// ── getAllTokens ───────────────────────────────────────────────────────────

describe('getAllTokens', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Silence console.warn but still allow us to assert on it.
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ── happy path ────────────────────────────────────────────────────────────

  it('merges all 10 built-in token files into a single object', () => {
    tenFileMock();
    expect(getAllTokens()).toEqual({
      color:      'red',
      font:       'sans',
      space:      '4px',
      shadow:     '1px',
      motion:     'ease',
      border:     '1px',
      zIndex:     100,
      opacity:    0.5,
      breakpoint: '768px',
      toast:      { maxVisible: 5 },
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ── partial failure — one file missing ───────────────────────────────────

  it('skips a missing file, emits one warn, and merges the rest', () => {
    tenFileMock({
      'typography.json': () => {
        throw new Error('File not found');
      },
    });
    const tokens = getAllTokens();
    expect(tokens).not.toHaveProperty('font');
    expect(tokens).toHaveProperty('color', 'red');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load typography.json:',
      expect.any(Error),
    );
  });

  // ── partial failure — one file malformed JSON ─────────────────────────────

  it('skips a malformed file, emits one warn, and merges the rest', () => {
    tenFileMock({ 'typography.json': '{"invalid":}' });
    const tokens = getAllTokens();
    expect(tokens).not.toHaveProperty('font');
    expect(tokens).toHaveProperty('color', 'red');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load typography.json:',
      expect.any(SyntaxError),
    );
  });

  // ── first file fails, rest continue ──────────────────────────────────────

  it('continues and merges remaining files when the first file fails', () => {
    tenFileMock({
      'colors.json': () => {
        throw new Error('File not found');
      },
    });
    const tokens = getAllTokens();
    expect(tokens).not.toHaveProperty('color');
    expect(tokens).toHaveProperty('font', 'sans');
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load colors.json:',
      expect.any(Error),
    );
  });

  // ── last file fails, earlier files kept ──────────────────────────────────

  it('retains earlier files when the last file fails', () => {
    tenFileMock({
      'toast.json': () => {
        throw new Error('File not found');
      },
    });
    const tokens = getAllTokens();
    expect(tokens).not.toHaveProperty('toast');
    expect(tokens).toHaveProperty('color', 'red');
    expect(tokens).toHaveProperty('breakpoint', '768px');
  });

  // ── all files fail → empty object + 10 warns ─────────────────────────────

  it('returns an empty object and emits exactly one warn per file when all fail', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('All files missing');
    });
    const tokens = getAllTokens();
    expect(tokens).toEqual({});
    // There are 10 token files in the built-in list.
    expect(warnSpy).toHaveBeenCalledTimes(10);
  });

  // ── key collision — later file wins ──────────────────────────────────────

  it('lets a later file overwrite an earlier one for the same top-level key', () => {
    // Both colors.json (position 0) and breakpoints.json (position 8) emit
    // the key 'token'; the later one must win.
    tenFileMock({
      'colors.json':      '{"token":"from-colors"}',
      'breakpoints.json': '{"token":"from-breakpoints"}',
    });
    expect(getAllTokens()).toMatchObject({ token: 'from-breakpoints' });
  });

  // ── file after a failing one is still merged ──────────────────────────────

  it('merges a file that appears after a failing one', () => {
    tenFileMock({
      'colors.json': () => {
        throw new Error('File not found');
      },
      'breakpoints.json': '{"breakpoint":"768px"}',
    });
    const tokens = getAllTokens();
    expect(tokens).toHaveProperty('breakpoint', '768px');
  });
});

// ── getTokenValue ──────────────────────────────────────────────────────────

/**
 * getTokenValue is tested against an in-memory mock of getAllTokens / loadTokens
 * so we control the full token tree without hitting the filesystem.
 */
describe('getTokenValue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Provide a consistent 10-file mock for every test.
    mockedFs.readFileSync.mockImplementation((filePath) => {
      const name = String(filePath).split(/[\\/]/).pop();
      if (name === 'colors.json') {
        return JSON.stringify({
          color: {
            primary: {
              // Mode-aware node: has both 'light' and 'dark' sub-objects each
              // containing a '$value'.
              light: { $type: 'color', $value: '#0A0A0A' },
              dark:  { $type: 'color', $value: '#F5F5F5' },
            },
            // DTCG leaf node — $value is at the top level.
            surface: { $type: 'color', $value: '#FFFFFF' },
            // Raw non-leaf node (no $value, no mode keys).
            scale: { 100: '#E0E0E0', 200: '#BDBDBD' },
          },
        }) as any;
      }
      return '{}' as any;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  // ── missing keys ──────────────────────────────────────────────────────────

  it('returns undefined when the top-level key does not exist', () => {
    expect(getTokenValue('nonexistent')).toBeUndefined();
  });

  it('returns undefined when an intermediate segment does not exist', () => {
    expect(getTokenValue('color.primary.missing')).toBeUndefined();
  });

  it('returns undefined when traversal reaches a non-object before the end', () => {
    // color.surface.$value is '#FFFFFF' (string); trying to go deeper fails.
    expect(getTokenValue('color.surface.$value.deeper')).toBeUndefined();
  });

  // ── DTCG leaf node ($value) ───────────────────────────────────────────────

  it('returns $value directly from a DTCG leaf node', () => {
    // color.surface = { $type: 'color', $value: '#FFFFFF' }
    expect(getTokenValue('color.surface')).toBe('#FFFFFF');
  });

  it('returns $value when the path ends at a nested DTCG leaf directly', () => {
    // color.primary.light = { $type: 'color', $value: '#0A0A0A' }
    expect(getTokenValue('color.primary.light')).toBe('#0A0A0A');
  });

  it('returns the raw $value string when the full dotted path ends at $value', () => {
    // Explicit traversal all the way to the $value key.
    expect(getTokenValue('color.surface.$value')).toBe('#FFFFFF');
  });

  // ── mode-aware resolution ─────────────────────────────────────────────────

  it('resolves the light variant when mode is "light" (default)', () => {
    // color.primary has {light:{$value:'#0A0A0A'}, dark:{$value:'#F5F5F5'}}
    expect(getTokenValue('color.primary')).toBe('#0A0A0A');
  });

  it('resolves the dark variant when mode is "dark"', () => {
    expect(getTokenValue('color.primary', 'dark')).toBe('#F5F5F5');
  });

  it('falls back to the raw node when the preferred mode key is absent', () => {
    // color.scale has no mode sub-keys (and no $value), so it is returned as-is.
    const result = getTokenValue('color.scale');
    expect(result).toEqual({ 100: '#E0E0E0', 200: '#BDBDBD' });
  });

  // ── node type boundaries ──────────────────────────────────────────────────

  it('returns undefined when a mid-path node is null', () => {
    // Inject a null at color.primary to simulate a corrupted token file.
    mockedFs.readFileSync.mockImplementation(() =>
      JSON.stringify({ color: { primary: null } }) as any,
    );
    expect(getTokenValue('color.primary.light')).toBeUndefined();
  });

  it('returns undefined when a mid-path node is a primitive (string)', () => {
    mockedFs.readFileSync.mockImplementation(() =>
      JSON.stringify({ color: { primary: 'flat-string' } }) as any,
    );
    expect(getTokenValue('color.primary.light')).toBeUndefined();
  });

  it('returns a numeric $value without modification', () => {
    mockedFs.readFileSync.mockImplementation(() =>
      JSON.stringify({ zIndex: { modal: { $type: 'number', $value: 900 } } }) as any,
    );
    expect(getTokenValue('zIndex.modal')).toBe(900);
  });

  it('returns an array $value without modification', () => {
    const bezier = [0.4, 0, 0.2, 1];
    mockedFs.readFileSync.mockImplementation(() =>
      JSON.stringify({ motion: { easeInOut: { $type: 'cubicBezier', $value: bezier } } }) as any,
    );
    expect(getTokenValue('motion.easeInOut')).toEqual(bezier);
  });

  // ── no mutable state bleeds between calls ────────────────────────────────

  it('returns consistent results across repeated calls with the same mock', () => {
    const first  = getTokenValue('color.surface');
    const second = getTokenValue('color.surface');
    expect(first).toBe(second);
  });
});
