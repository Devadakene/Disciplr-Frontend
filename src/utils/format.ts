/**
 * src/utils/format.ts
 *
 * Centralized, locale-aware formatting module for USDC amounts, dates, and relative time.
 * Pure and locale-injectable for tests.
 */

let testLocaleOverride: string | null = null;

/**
 * Override the locale used by formatting utilities (primarily for unit tests).
 * Pass `null` to reset back to runtime detection.
 */
export function setTestLocale(locale: string | null): void {
  testLocaleOverride = locale;
}

/**
 * Returns the current active locale:
 * 1. Test override if set via `setTestLocale()`.
 * 2. `navigator.languages[0]` or `navigator.language` if available in the runtime environment.
 * 3. Fallback to 'en'.
 */
export function getLocale(): string {
  if (testLocaleOverride) {
    return testLocaleOverride;
  }
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0 && navigator.languages[0]) {
      return navigator.languages[0];
    }
    if (navigator.language) {
      return navigator.language;
    }
  }
  return 'en';
}

export interface FormatUsdcOptions {
  /**
   * If true, always retains all significant fractional digits up to 7 decimals.
   * If false/omitted, formats with up to 7 decimals, trailing zeros trimmed, minimum 2 decimals.
   */
  exact?: boolean;
}

/**
 * Format a USDC amount with exact precision without floating-point inaccuracies.
 * Supports string, number, or bigint inputs.
 * Maximum 7 decimal places (1 stroop = 0.0000001 USDC).
 *
 * Rules:
 * - exact: true -> display all significant decimals without rounding/truncation, up to 7 decimals.
 *                  E.g., 0.0000001 stays 0.0000001, 100 stays 100 (or 100.00 if formatted as standard).
 * - exact: false (default) -> minimum 2 decimals, up to 7 decimals with trailing fractional zeros trimmed beyond 2 decimals.
 * - String inputs with more than 7 decimals throw an Error.
 * - Negative values are formatted properly with the negative sign.
 * - Invalid/NaN values throw an Error.
 */
export function formatUsdc(
  value: string | number | bigint,
  options: FormatUsdcOptions = {}
): string {
  const { exact = false } = options;
  const locale = getLocale();

  let str = typeof value === 'bigint' ? value.toString() : String(value).trim();

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error(`Invalid USDC amount: ${value}`);
    }
    // Convert scientific notation if any
    str = value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
  }

  if (str === '' || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(str)) {
    throw new Error(`Invalid USDC amount: ${value}`);
  }

  const isNegative = str.startsWith('-');
  const isPositive = str.startsWith('+');
  if (isNegative || isPositive) {
    str = str.slice(1);
  }

  let integerPartRaw = str.split('.')[0];
  const fractionalPartRaw = str.split('.')[1] ?? '';

  // Normalize integer part: strip leading zeros except if single zero
  integerPartRaw = integerPartRaw.replace(/^0+(?=\d)/, '');
  if (!integerPartRaw) {
    integerPartRaw = '0';
  }

  // If input string has more than 7 decimal digits, throw error
  if (fractionalPartRaw.length > 7) {
    throw new Error(`USDC amount exceeds maximum 7 decimal places: ${value}`);
  }

  // Determine decimal formatting
  let finalFractional = fractionalPartRaw;
  if (exact) {
    // Trim trailing zeros from fractional part for exact display, but keep at least what's significant
    finalFractional = finalFractional.replace(/0+$/, '');
  } else {
    // Default display: minimum 2 decimal places, up to 7 decimal places, trailing zeros beyond 2 trimmed.
    if (finalFractional.length < 2) {
      finalFractional = finalFractional.padEnd(2, '0');
    } else {
      // Trim trailing zeros beyond 2
      const trimmed = finalFractional.replace(/0+$/, '');
      finalFractional = trimmed.length < 2 ? trimmed.padEnd(2, '0') : trimmed;
    }
  }

  // Format integer part using Intl.NumberFormat for the locale
  const integerBigInt = BigInt(integerPartRaw);
  const formattedInteger = new Intl.NumberFormat(locale, {
    useGrouping: true,
  }).format(integerBigInt);

  // Get locale decimal separator
  const decimalSeparator = new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find((part) => part.type === 'decimal')?.value ?? '.';

  const sign = isNegative && (integerBigInt !== 0n || finalFractional.replace(/0/g, '').length > 0) ? '-' : '';

  if (finalFractional.length > 0) {
    return `${sign}${formattedInteger}${decimalSeparator}${finalFractional}`;
  }

  return `${sign}${formattedInteger}`;
}

/**
 * Format a date as a locale-aware date string.
 * Invalid dates return a stable fallback "—" (em-dash).
 */
export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) {
    return '—';
  }
  const locale = getLocale();
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
}

/**
 * Format a date and time with a short timezone abbreviation.
 * Example: "18 Jun 2026, 12:00 UTC" or "Jun 18, 2026, 1:00 PM BST"
 * Invalid dates return "—".
 */
export function formatDateTime(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) {
    return '—';
  }
  const locale = getLocale();
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    ...options,
  };
  return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
}

/**
 * Format a relative time string using Intl.RelativeTimeFormat in the active locale.
 * For dates beyond 30 days, falls back to formatDate.
 */
export function formatRelative(
  date: Date | string | number,
  now: number = Date.now()
): string {
  const timestamp = typeof date === 'number' ? date : new Date(date).getTime();
  if (!Number.isFinite(timestamp)) {
    return '—';
  }

  const locale = getLocale();
  const diffInSeconds = (timestamp - now) / 1000;
  const absDiff = Math.abs(diffInSeconds);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });

  // Under 60 seconds
  if (absDiff < 60) {
    if (absDiff < 10) {
      return diffInSeconds > 0 ? 'in a moment' : 'just now';
    }
    return rtf.format(Math.round(diffInSeconds), 'second');
  }

  // Under 1 hour
  if (absDiff < 3600) {
    const minutes = Math.round(diffInSeconds / 60);
    return rtf.format(minutes, 'minute');
  }

  // Under 24 hours
  if (absDiff < 86400) {
    const hours = Math.round(diffInSeconds / 3600);
    return rtf.format(hours, 'hour');
  }

  // Under 7 days
  if (absDiff < 604800) {
    const days = Math.round(diffInSeconds / 86400);
    return rtf.format(days, 'day');
  }

  // Under 30 days
  if (absDiff < 2592000) {
    const weeks = Math.round(diffInSeconds / 604800);
    return rtf.format(weeks, 'week');
  }

  // Beyond 30 days, fall back to localized absolute date
  const dateObj = new Date(timestamp);
  const isSameYear = dateObj.getFullYear() === new Date(now).getFullYear();
  return formatDate(dateObj, {
    month: 'short',
    day: 'numeric',
    year: isSameYear ? undefined : 'numeric',
  });
}

/**
 * Convert a local datetime string (e.g., from <input type="datetime-local"> like "2026-11-01T09:00")
 * to a UTC ISO string (e.g. "2026-11-01T09:00:00.000Z").
 */
export function toUtcIso(localDateTimeValue: string): string {
  if (!localDateTimeValue || localDateTimeValue.trim() === '') {
    return '';
  }
  const date = new Date(localDateTimeValue);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  return date.toISOString();
}

/**
 * Convert a UTC ISO string back to a local YYYY-MM-DDTHH:mm string for datetime-local input fields.
 */
export function fromUtcIsoToLocalInput(iso: string): string {
  if (!iso || iso.trim() === '') {
    return '';
  }
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
