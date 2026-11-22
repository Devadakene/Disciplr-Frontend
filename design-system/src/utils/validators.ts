/**
 * Token validation utilities
 *
 * Invariants:
 * - Validators are pure and deterministic: the same input always yields the
 *   same boolean result, and no exception is thrown for any input (including
 *   non-strings, null, undefined, arrays, and cyclic objects).
 * - Color string validation is strict and fully anchored; trailing or
 *   leading garbage is rejected.
 * - Color channels are bounded (0..255 for rgb, hue 0..360, saturation/lightness
 *   0..100%) so out-of-range values cannot silently pass.
 * - Token validation is defensive: nested objects are guarded against
 *   prototype pollution and against non-object types.
 * - Chart token validation enforces the minimum ramp size and requires both
 *   light and dark variants for every step.
 */

export const VALID_TOKEN_PREFIXES = [
  'chart',
  'color',
  'font',
  'spacing',
  'typography',
  'shadow',
  'radius',
  'border',
  'motion',
  'z-index',
] as const;

export type ValidTokenPrefix = (typeof VALID_TOKEN_PREFIXES)[number];

const HEX_COLOR_REGEX = /^#(?:[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{6}|[0-9A-F]{8})$/i;
const RGB_COLOR_REGEX = /^rgb\(\d+,\s*\d+,\s*\d+\)$/;
const HSL_COLOR_REGEX = /^hsl\(\d+,\s*\d+%,\s*\d+%\)$/;
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const MAX_RGB_CHANNEL = 255;
const MAX_HSL_HUE = 360;
const MAX_HSL_PERCENTAGE = 100;

export const MIN_CHART_RAMP_STEPS = 5;

/** Ramp step keys are numeric ("1", "100") or "step-N". */
const RAMP_STEP_KEY_REGEX = /^(?:step-)?\d+$/;

const CHART_SURFACE_KEYS = [
  'axis',
  'grid',
  'tooltipBg',
  'tooltipBorder',
  'tooltipText',
  'tooltipLabel',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function isValidHexColor(color: unknown): boolean {
  return typeof color === 'string' && HEX_COLOR_REGEX.test(color);
}

export function isValidRgbColor(color: unknown): boolean {
  if (typeof color !== 'string') return false;
  const match = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return false;
  const [, r, g, b] = match;
  return [r, g, b].every(channel => {
    const n = Number(channel);
    return Number.isInteger(n) && n >= 0 && n <= MAX_RGB_CHANNEL;
  });
}

export function isValidHslColor(color: unknown): boolean {
  if (typeof color !== 'string') return false;
  const match = color.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
  if (!match) return false;
  const [, h, s, l] = match;
  const hue = Number(h);
  const sat = Number(s);
  const light = Number(l);
  return (
    Number.isInteger(hue) && hue >= 0 && hue <= MAX_HSL_HUE &&
    Number.isInteger(sat) && sat >= 0 && sat <= MAX_HSL_PERCENTAGE &&
    Number.isInteger(light) && light >= 0 && light <= MAX_HSL_PERCENTAGE
  );
}

export function isKebabCase(str: unknown): boolean {
  return typeof str === 'string' && KEBAB_CASE_REGEX.test(str);
}

export function hasValidTokenPrefix(tokenName: unknown): boolean {
  if (typeof tokenName !== 'string') return false;
  return VALID_TOKEN_PREFIXES.some(prefix => tokenName.startsWith(prefix + '-'));
}

export function isValidColorString(color: unknown): boolean {
  return isValidHexColor(color) || isValidRgbColor(color) || isValidHslColor(color);
}

export function isValidColorToken(token: unknown): boolean {
  if (!isPlainObject(token)) return false;

  if (token.$type !== 'color') return false;
  if (typeof token.$value !== 'string' || !isValidColorString(token.$value)) return false;

  // Validate accessibility properties if present
  if (hasOwn(token, 'accessibility')) {
    const acc = token.accessibility;
    if (!isPlainObject(acc)) return false;

    if (hasOwn(acc, 'wcagLevel') && acc.wcagLevel !== undefined) {
      if (acc.wcagLevel !== 'AA' && acc.wcagLevel !== 'AAA') return false;
    }
    if (hasOwn(acc, 'colorblindSafe') && acc.colorblindSafe !== undefined) {
      if (typeof acc.colorblindSafe !== 'boolean') return false;
    }
    if (hasOwn(acc, 'colorblindSimulation') && acc.colorblindSimulation !== undefined) {
      const sim = acc.colorblindSimulation;
      if (!isPlainObject(sim)) return false;
      const simKeys = ['protanopia', 'deuteranopia', 'tritanopia'] as const;
      for (const key of simKeys) {
        if (hasOwn(sim, key) && sim[key] !== undefined) {
          if (typeof sim[key] !== 'string' || !isValidColorString(sim[key])) return false;
        }
      }
    }
  }
  return true;
}

function isValidChartTokenGroup(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (!hasOwn(value, 'light') || !hasOwn(value, 'dark')) return false;
  return isValidColorToken(value.light) && isValidColorToken(value.dark);
}

function isValidRamp(ramp: unknown): boolean {
  if (!isPlainObject(ramp)) return false;
  const steps = Object.keys(ramp);
  if (steps.length < MIN_CHART_RAMP_STEPS) return false;
  for (const step of steps) {
    if (!RAMP_STEP_KEY_REGEX.test(step)) return false;
    if (!isValidChartTokenGroup(ramp[step])) return false;
  }
  return true;
}

export function isValidChartTokens(chart: unknown): boolean {
  if (!isPlainObject(chart)) return false;

  // 1. Validate surface tokens
  for (const key of CHART_SURFACE_KEYS) {
    if (!hasOwn(chart, key)) return false;
    if (!isValidChartTokenGroup(chart[key])) return false;
  }

  // 2. Validate categorical ramp
  if (!hasOwn(chart, 'categorical')) return false;
  if (!isValidRamp(chart.categorical)) return false;

  // 3. Validate sequential ramp
  if (!hasOwn(chart, 'sequential')) return false;
  if (!isValidRamp(chart.sequential)) return false;

  return true;
}
