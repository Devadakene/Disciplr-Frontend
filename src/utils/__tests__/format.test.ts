import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  getLocale,
  setTestLocale,
  formatUsdc,
  formatDate,
  formatDateTime,
  formatRelative,
  toUtcIso,
  fromUtcIsoToLocalInput,
} from '../format';

describe('format module', () => {
  beforeEach(() => {
    setTestLocale('en-US');
  });

  afterEach(() => {
    setTestLocale(null);
  });

  describe('locale resolution', () => {
    it('uses injected test locale when set', () => {
      setTestLocale('de-DE');
      expect(getLocale()).toBe('de-DE');
    });

    it('falls back to navigator or en when testLocale is null', () => {
      setTestLocale(null);
      const loc = getLocale();
      expect(typeof loc).toBe('string');
      expect(loc.length).toBeGreaterThan(0);
    });
  });

  describe('formatUsdc table tests across locales & edge values', () => {
    it('formats edge values properly in en-US', () => {
      setTestLocale('en-US');
      expect(formatUsdc('0.0000001')).toBe('0.0000001');
      expect(formatUsdc('12.3456789')).toBe('12.3456789');
      expect(formatUsdc(1000)).toBe('1,000.00');
      expect(formatUsdc('1000', { exact: true })).toBe('1,000');
      expect(formatUsdc(0)).toBe('0.00');
      expect(formatUsdc(0, { exact: true })).toBe('0');
      expect(formatUsdc('0', { exact: true })).toBe('0');
      expect(formatUsdc('9999999999.9999999')).toBe('9,999,999,999.9999999');
      expect(formatUsdc(BigInt(5000000))).toBe('5,000,000.00');
      expect(formatUsdc(BigInt(5000000), { exact: true })).toBe('5,000,000');
      expect(formatUsdc('-50.123')).toBe('-50.123');
      expect(formatUsdc(-50.123)).toBe('-50.123');
    });

    it('formats values properly across de-DE, fr-FR, ja-JP', () => {
      setTestLocale('de-DE');
      expect(formatUsdc(1000)).toBe('1.000,00');
      expect(formatUsdc('0.0000001')).toBe('0,0000001');
      expect(formatUsdc('12.3456789')).toBe('12,3456789');

      setTestLocale('fr-FR');
      // In French, grouping separator is narrow no-break space or space
      const frFormatted = formatUsdc(1000);
      expect(frFormatted).toMatch(/1[\s\u202f]000,00/);
      expect(formatUsdc('0.0000001')).toBe('0,0000001');

      setTestLocale('ja-JP');
      expect(formatUsdc(1000)).toBe('1,000.00');
      expect(formatUsdc('0.0000001')).toBe('0.0000001');
    });

    it('handles negative and zero edges', () => {
      setTestLocale('en-US');
      expect(formatUsdc('-0')).toBe('0.00');
      expect(formatUsdc('-0.0000001')).toBe('-0.0000001');
      expect(formatUsdc('-1000')).toBe('-1,000.00');
    });

    it('throws on string with more than 7 decimals', () => {
      expect(() => formatUsdc('1.12345678')).toThrow(/exceeds maximum 7 decimal places/);
    });

    it('throws on NaN or invalid strings', () => {
      expect(() => formatUsdc(NaN)).toThrow(/Invalid USDC amount/);
      expect(() => formatUsdc('not-a-number')).toThrow(/Invalid USDC amount/);
      expect(() => formatUsdc('')).toThrow(/Invalid USDC amount/);
    });

    it('fast-check property test: exact formatting round-trip preserves normalized amount', () => {
      setTestLocale('en-US');
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 0, max: 9999999 }),
          (intPart, fracPart) => {
            const fracStr = fracPart === 0 ? '' : fracPart.toString().replace(/0+$/, '');
            const raw = fracStr.length > 0 ? `${intPart}.${fracStr}` : `${intPart}`;

            const formatted = formatUsdc(raw, { exact: true });
            // Remove locale grouping commas
            const cleaned = formatted.replace(/,/g, '');
            expect(cleaned).toBe(raw);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('formatDate and formatDateTime', () => {
    it('returns "—" for invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('—');
      expect(formatDateTime('invalid-date')).toBe('—');
    });

    it('formats dates according to locale', () => {
      setTestLocale('en-US');
      const d = new Date('2026-10-25T10:00:00Z');
      expect(formatDate(d)).toBe('Oct 25, 2026');

      setTestLocale('de-DE');
      expect(formatDate(d)).toBe('25. Okt. 2026');
    });

    it('formatDateTime includes short timezone', () => {
      setTestLocale('en-US');
      const d = new Date('2026-10-25T10:00:00Z');
      const res = formatDateTime(d, { timeZone: 'UTC' });
      expect(res).toContain('UTC');
      expect(res).toContain('10:00');
    });
  });

  describe('formatRelative boundaries', () => {
    const fixedNow = new Date('2026-06-18T12:00:00Z').getTime();

    it('formats < 10s', () => {
      setTestLocale('en-US');
      expect(formatRelative(fixedNow - 5000, fixedNow)).toBe('just now');
      expect(formatRelative(fixedNow + 5000, fixedNow)).toBe('in a moment');
    });

    it('formats 59s vs 60s boundary', () => {
      setTestLocale('en-US');
      expect(formatRelative(fixedNow - 59000, fixedNow)).toBe('59 seconds ago');
      expect(formatRelative(fixedNow - 60000, fixedNow)).toBe('1 minute ago');
    });

    it('formats 29d vs 31d boundary', () => {
      setTestLocale('en-US');
      const dayMs = 24 * 60 * 60 * 1000;
      // 29 days is < 2592000s (~30 days) -> formats in weeks
      expect(formatRelative(fixedNow - 29 * dayMs, fixedNow)).toBe('4 weeks ago');

      // 31 days -> falls back to formatDate in the active locale (not pt-US!)
      const res = formatRelative(fixedNow - 31 * dayMs, fixedNow);
      expect(res).toBe('May 18');
    });

    it('uses active locale for relative and fallback dates (pt-US is gone)', () => {
      setTestLocale('de-DE');
      const dayMs = 24 * 60 * 60 * 1000;
      expect(formatRelative(fixedNow - 31 * dayMs, fixedNow)).toBe('18. Mai');
    });
  });

  describe('datetime-local UTC round-trip', () => {
    it('handles empty or invalid inputs', () => {
      expect(toUtcIso('')).toBe('');
      expect(toUtcIso('invalid')).toBe('');
      expect(fromUtcIsoToLocalInput('')).toBe('');
      expect(fromUtcIsoToLocalInput('invalid')).toBe('');
    });

    it('converts to UTC ISO and back to local input', () => {
      const localInput = '2026-11-01T09:00';
      const utcIso = toUtcIso(localInput);
      expect(utcIso).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);

      const roundTripLocal = fromUtcIsoToLocalInput(utcIso);
      expect(roundTripLocal).toBe(localInput);
    });
  });
});
