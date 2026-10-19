/**
 * Token loader utilities
 *
 * Invariants:
 * - `loadTokens(` rejects any name that is not a plain basename
 *   with a .json extension and ensures the resolved path stays within
 *   the tokens directory (path-traversal guard).
 * - `loadTokens(` fails fast on missing files, invalid JSON, or non-object
 *   payloads so callers can distinguish partial failure from success.
 * - `getAllTokens()` is deterministic and never throws: each file is
 *   loaded independently, failures are logged and skipped, and the result
 *   is a fresh object on every call (no shared mutable state).
 * - `getTokenValue()` is pure and deterministic for any input, including
 *   empty, malformed, and boundary paths.
 */

import { DesignTokens } from '../types/tokens';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

/** Maximum accepted length for a token file name. */
const MAX_TOKEN_FILE_NAME_LENGTH = 255;

/** Allowed token file names for `getAllTokens()`. */
const TOKEN_FILES = [
  'colors.json',
  'typography.json',
  'spacing.json',
  'shadows.json',
  'motion.json',
  'borders.json',
  'z-index.json',
  'opacity.json',
  'breakpoints.json',
  'toast.json',
] as const;

/**
 * Returns the absolute tokens directory for the current process.
 */
function getTokensDir(): string {
  return path.resolve(process.cwd(), 'tokens');
}

/**
 * Validates a token file name and returns its absolute path within the
 * tokens directory. Throws on invalid names or path traversal attempts.
 */
function resolveTokenPath(tokenFile: string): string {
  if (typeof tokenFile !== 'string' || tokenFile.length === 0) {
    throw new Error('Invalid token file name: expected a non-empty string');
  }

  if (tokenFile.length > MAX_TOKEN_FILE_NAME_LENGTH) {
    throw new Error(
      `Invalid token file name: exceeds ${MAX_TOKEN_FILE_NAME_LENGTH} characters`,
    );
  }

  // Reject anything that isn't a plain basename with a .json extension.
  // This also rejects null bytes, query fragments, and absolute paths.
  // Control characters (including null bytes) are rejected up front. The
  // offending name is never echoed back so error messages cannot leak paths.
  if (/[\u0000-\u001f\u007f]/.test(tokenFile) || !/^[^/\\]+\.json$/.test(tokenFile)) {
    throw new Error('Invalid token file name: expected a plain .json basename');
  }

  const tokensDir = getTokensDir();
  const tokenPath = path.resolve(tokensDir, tokenFile);

  // Ensure resolved path stays within the tokens directory.
  if (!tokenPath.startsWith(tokensDir + path.sep)) {
    throw new Error(`Path traversal detected for token file: "${tokenFile}"`);
  }

  return tokenPath;
}

/**
 * Loads and parses a single token file.
 *
 * @throws when the name is invalid, the file is missing/unreadable, the
 * JSON is malformed, or the parsed payload is not a plain object.
 */
export function loadTokens(tokenFile: string): DesignTokens {
  const tokenPath = resolveTokenPath(tokenFile);

  let tokenData: string;
  try {
    tokenData = fs.readFileSync(tokenPath, 'utf-8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    throw new Error(
      `Unable to read token file "${tokenFile}"${code ? ` (${code})` : ''}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(tokenData);
  } catch {
    throw new SyntaxError(`Invalid JSON in token file "${tokenFile}"`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Token file "${tokenFile}" must contain a JSON object`);
  }

  return parsed as DesignTokens;
}

/**
 * Loads and merges all known token files.
 *
 * Never throws: failures are logged and the corresponding file is skipped.
 * Returns a fresh object on every call so callers cannot mutate shared state.
 */
export function getAllTokens(): DesignTokens {
  const allTokens: DesignTokens = {};

  for (const file of TOKEN_FILES) {
    try {
      const tokens = loadTokens(file);
      for (const [key, value] of Object.entries(tokens)) {
        // Skip DTCG file-level metadata such as "$schema".
        if (!key.startsWith('$')) {
          (allTokens as Record<string, unknown>)[key] = value;
        }
      }
    } catch (error) {
      logger.warn(`Failed to load ${file}:`, error);
    }
  }

  return allTokens;
}

/**
 * Resolves a design token by dotted path from the merged DTCG token tree.
 *
 * Path segments map directly to JSON object keys, e.g.:
 *   "color.primary.light.$value"  → traverses color → primary → light → $value
 *   "color.primary"               → if the resolved node contains mode sub-keys
 *                                   ('light'/'dark'), resolves via `mode`
 *                                   and returns `$value`; otherwise returns
 *                                   the raw node.
 *
 * @param path - Dot-separated key path into the token tree.
 * @param mode - Preferred mode for tokens that have 'light'/'dark' variants.
 *               Defaults to 'light'.
 * @returns The resolved `$value` (or raw node) for the path, or `undefined`
 *          when any segment is missing.
 */
export function getTokenValue(
  path: string,
  mode: 'light' | 'dark' = 'light',
): unknown {
  if (typeof path !== 'string' || path.length === 0) return undefined;

  let node: unknown = getAllTokens();

  for (const segment of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[segment];
    if (node === undefined) return undefined;
  }

  // If the resolved node is a plain object with both mode keys, resolve by mode.
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    const record = node as Record<string, unknown>;

    // Mode-aware resolution: node has 'light' or 'dark' sub-objects that are
    // DTCG token nodes (i.e. contain a $value key).
    const modeNode = record[mode] as Record<string, unknown> | undefined;
    if (
      modeNode !== undefined &&
      modeNode !== null &&
      typeof modeNode === 'object' &&
      '$value' in modeNode
    ) {
      return modeNode['$value'];
    }

    // Already a DTCG leaf node — return its $value directly.
    if ('$value' in record) {
      return record['$value'];
    }
  }

  return node;
}
