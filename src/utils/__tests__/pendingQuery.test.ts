import { describe, expect, it } from 'vitest';
import {
  parsePendingQuery,
  serializePendingQuery,
  parseSearch,
  parseMilestone,
  parseSortKey,
  parseSortDirection,
  DEFAULT_PENDING_QUERY,
  type PendingQueryState,
} from '../pendingQuery';

describe('pendingQuery URL parsing and serialization', () => {
  it('returns default state when params are empty', () => {
    const params = new URLSearchParams('');
    const parsed = parsePendingQuery(params);
    expect(parsed).toEqual(DEFAULT_PENDING_QUERY);
  });

  it('parses valid params correctly', () => {
    const params = new URLSearchParams(
      'q=launch&milestone=Phase%201&sort=amount&dir=desc',
    );
    const parsed = parsePendingQuery(params);
    expect(parsed).toEqual({
      q: 'launch',
      milestone: 'Phase 1',
      sort: 'amount',
      dir: 'desc',
    });
  });

  it('falls back to defaults for invalid sort and dir (sort=bogus&dir=up)', () => {
    const params = new URLSearchParams('sort=bogus&dir=up');
    const parsed = parsePendingQuery(params);
    expect(parsed).toEqual(DEFAULT_PENDING_QUERY);
  });

  it('falls back safely on unknown or malformed params without throwing', () => {
    const params = new URLSearchParams(
      'q=&milestone=&sort=unknown_sort&dir=reversed&foo=bar',
    );
    const parsed = parsePendingQuery(params);
    expect(parsed).toEqual(DEFAULT_PENDING_QUERY);
  });

  it('normalizes search and milestone whitespace', () => {
    const params = new URLSearchParams(
      'q=%20%20alice%20in%20chains%20%20&milestone=%20%20Milestone%201%20%20',
    );
    const parsed = parsePendingQuery(params);
    expect(parsed.q).toBe('alice in chains');
    expect(parsed.milestone).toBe('Milestone 1');
  });

  it('round-trips state cleanly for ?q=alice&sort=amount&dir=desc', () => {
    const searchString = 'q=alice&sort=amount&dir=desc';
    const params = new URLSearchParams(searchString);
    const parsed = parsePendingQuery(params);

    expect(parsed).toEqual({
      q: 'alice',
      milestone: '',
      sort: 'amount',
      dir: 'desc',
    });

    const serialized = serializePendingQuery(parsed);
    expect(serialized.toString()).toBe(searchString);

    const roundTripped = parsePendingQuery(serialized);
    expect(roundTripped).toEqual(parsed);
  });

  it('round-trips state with milestone and sort=vaultName', () => {
    const initial: PendingQueryState = {
      q: 'bob',
      milestone: 'Sprint 3',
      sort: 'vaultName',
      dir: 'desc',
    };
    const serialized = serializePendingQuery(initial);
    const roundTripped = parsePendingQuery(serialized);
    expect(roundTripped).toEqual(initial);
  });

  it('omits default values when serializing', () => {
    const serialized = serializePendingQuery({
      q: '',
      milestone: '',
      sort: 'deadline',
      dir: 'asc',
    });
    expect(serialized.toString()).toBe('');
  });

  it('omits default sort and dir when only q is non-default', () => {
    const serialized = serializePendingQuery({
      q: 'test',
      sort: 'deadline',
      dir: 'asc',
    });
    expect(serialized.toString()).toBe('q=test');
  });

  it('accepts raw string queries in parsePendingQuery', () => {
    const parsed = parsePendingQuery('?q=charlie&sort=vaultName');
    expect(parsed).toEqual({
      q: 'charlie',
      milestone: '',
      sort: 'vaultName',
      dir: 'asc',
    });
  });

  describe('individual parsers', () => {
    it('parseSearch handles null, undefined, and trimming', () => {
      expect(parseSearch(null)).toBe('');
      expect(parseSearch(undefined)).toBe('');
      expect(parseSearch('   ')).toBe('');
      expect(parseSearch('  hello  ')).toBe('hello');
    });

    it('parseMilestone handles null, undefined, and trimming', () => {
      expect(parseMilestone(null)).toBe('');
      expect(parseMilestone(undefined)).toBe('');
      expect(parseMilestone('   ')).toBe('');
      expect(parseMilestone('  Phase 2  ')).toBe('Phase 2');
    });

    it('parseSortKey whitelists valid keys and defaults invalid', () => {
      expect(parseSortKey('deadline')).toBe('deadline');
      expect(parseSortKey('amount')).toBe('amount');
      expect(parseSortKey('vaultName')).toBe('vaultName');
      expect(parseSortKey('invalid')).toBe('deadline');
      expect(parseSortKey(null)).toBe('deadline');
    });

    it('parseSortDirection whitelists asc and desc and defaults invalid', () => {
      expect(parseSortDirection('asc')).toBe('asc');
      expect(parseSortDirection('desc')).toBe('desc');
      expect(parseSortDirection('up')).toBe('asc');
      expect(parseSortDirection('down')).toBe('asc');
      expect(parseSortDirection(null)).toBe('asc');
    });
  });
});
