import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCalendar,
  buildIcsEvent,
  downloadIcs,
  downloadIcsCalendar,
  downloadIcsEvent,
  escapeIcsText,
  foldIcsLine,
  formatIcsDate,
  getDeadlineSequence,
  icsFilename,
  isValidIcsDeadline,
  vaultDeadlineUid,
  vaultToIcsEvents,
  type AlarmPreference,
  type IcsEventInput,
  type VaultLike,
} from '../ics';

describe('ics utilities', () => {
  const fixedNow = new Date('2026-06-01T10:00:00Z');
  let mockClick: ReturnType<typeof vi.fn>;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let hadGlobalDocument = false;

  beforeEach(() => {
    mockClick = vi.fn();
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:deadline-calendar');
    URL.revokeObjectURL = vi.fn();

    if (typeof document === 'undefined') {
      hadGlobalDocument = false;
      const elementMock = {
        setAttribute: vi.fn(),
        style: {},
        click: mockClick,
      };
      (globalThis as any).document = {
        createElement: vi.fn(() => elementMock),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        querySelector: vi.fn(() => null),
      };
    } else {
      hadGlobalDocument = true;
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mockClick);
    }
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
    if (!hadGlobalDocument) {
      delete (globalThis as any).document;
    }
  });

  describe('RFC 5545 compliance & line constraints', () => {
    it('golden-file test of a full calendar with fixed now, sequence, status, url and alarms', () => {
      const calendar = buildCalendar(
        [
          {
            title: 'Alpha Vault deadline',
            deadline: '2026-07-15T12:30:00Z',
            description: 'Alpha Vault deadline for 12,500 USDC.',
            uid: 'vault-1@disciplr.app',
            vaultId: '1',
            alarms: 'both',
          },
        ],
        {
          now: fixedNow,
          origin: 'https://disciplr.app',
        }
      );

      // Verify CRLF and line structure
      expect(calendar).toContain('BEGIN:VCALENDAR\r\n');
      expect(calendar).toContain('VERSION:2.0\r\n');
      expect(calendar).toContain('PRODID:-//Disciplr//Vault Deadline//EN\r\n');
      expect(calendar).toContain('CALSCALE:GREGORIAN\r\n');
      expect(calendar).toContain('METHOD:PUBLISH\r\n');
      expect(calendar).toContain('BEGIN:VEVENT\r\n');
      expect(calendar).toContain('UID:vault-1@disciplr.app\r\n');
      expect(calendar).toContain('DTSTAMP:20260601T100000Z\r\n');
      expect(calendar).toContain('DTSTART:20260715T123000Z\r\n');
      expect(calendar).toContain('DURATION:PT30M\r\n');
      expect(calendar).toContain('SUMMARY:Alpha Vault deadline\r\n');
      expect(calendar).toContain('DESCRIPTION:Alpha Vault deadline for 12\\,500 USDC.\r\n');
      expect(calendar).toContain('STATUS:CONFIRMED\r\n');
      expect(calendar).toContain(`SEQUENCE:${getDeadlineSequence('2026-07-15T12:30:00Z')}\r\n`);
      expect(calendar).toContain('URL:https://disciplr.app/vaults/1\r\n');

      // VALARM blocks (both 1day and 1hour)
      expect(calendar).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Alpha Vault deadline\r\nTRIGGER:-P1D\r\nEND:VALARM\r\n');
      expect(calendar).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Alpha Vault deadline\r\nTRIGGER:-PT1H\r\nEND:VALARM\r\n');

      expect(calendar).toContain('END:VEVENT\r\n');
      expect(calendar.endsWith('END:VCALENDAR\r\n')).toBe(true);

      // Assert that every line ends with CRLF and no line exceeds 75 octets
      const lines = calendar.split('\r\n');
      // The last line after trailing CRLF is empty string
      for (const line of lines.slice(0, -1)) {
        const byteLen = new TextEncoder().encode(line).length;
        expect(byteLen).toBeLessThanOrEqual(75);
      }
    });

    it('DTSTAMP equals the export time, not the deadline', () => {
      const calendar = buildIcsEvent(
        {
          title: 'Beta Launch',
          deadline: '2026-10-25T15:00:00Z',
          uid: 'vault-2@disciplr.app',
        },
        { now: fixedNow }
      );

      expect(calendar).toContain('DTSTAMP:20260601T100000Z\r\n');
      expect(calendar).toContain('DTSTART:20261025T150000Z\r\n');
    });

    it('includes X-WR-CALNAME for multi-event calendars', () => {
      const calendar = buildCalendar(
        [
          {
            title: 'Vault 1',
            deadline: '2026-07-01T12:00:00Z',
            uid: 'vault-1@disciplr.app',
          },
          {
            title: 'Vault 2',
            deadline: '2026-08-01T12:00:00Z',
            uid: 'vault-2@disciplr.app',
          },
        ],
        { now: fixedNow }
      );

      expect(calendar).toContain('X-WR-CALNAME:Disciplr deadlines\r\n');
    });
  });

  describe('UID helper stability & uniqueness', () => {
    it('produces identical UIDs containing @disciplr.app for the same vault ID', () => {
      const uid1 = vaultDeadlineUid('42');
      const uid2 = vaultDeadlineUid('42');
      expect(uid1).toBe('vault-42@disciplr.app');
      expect(uid1).toBe(uid2);
      expect(uid1).toContain('@disciplr.app');
    });

    it('produces milestone UIDs when milestoneId is provided', () => {
      const uid = vaultDeadlineUid('v1', 'm1');
      expect(uid).toBe('milestone-v1-m1@disciplr.app');
    });
  });

  describe('SEQUENCE stability and progression', () => {
    it('SEQUENCE changes and increases when a deadline is extended', () => {
      const d1 = '2026-07-15T12:00:00Z';
      const d2 = '2026-07-20T12:00:00Z'; // extended deadline

      const seq1 = getDeadlineSequence(d1);
      const seq2 = getDeadlineSequence(d2);

      expect(seq1).not.toBe(seq2);
      expect(seq2).toBeGreaterThan(seq1);

      const event1 = buildIcsEvent(
        { title: 'Vault', deadline: d1, uid: 'vault-1@disciplr.app' },
        { now: fixedNow }
      );
      const event2 = buildIcsEvent(
        { title: 'Vault', deadline: d2, uid: 'vault-1@disciplr.app' },
        { now: fixedNow }
      );

      expect(event1).toContain(`SEQUENCE:${seq1}\r\n`);
      expect(event2).toContain(`SEQUENCE:${seq2}\r\n`);
    });
  });

  describe('alarm variants', () => {
    const futureDeadline = '2026-08-01T12:00:00Z';

    it('emits no alarms when preference is none', () => {
      const ics = buildIcsEvent(
        {
          title: 'No Alarms',
          deadline: futureDeadline,
          uid: 'v-none@disciplr.app',
          alarms: 'none',
        },
        { now: fixedNow }
      );
      expect(ics).not.toContain('BEGIN:VALARM');
    });

    it('emits only 1 hour alarm when preference is 1hour', () => {
      const ics = buildIcsEvent(
        {
          title: '1 Hour Alarm',
          deadline: futureDeadline,
          uid: 'v-1h@disciplr.app',
          alarms: '1hour',
        },
        { now: fixedNow }
      );
      expect(ics).toContain('TRIGGER:-PT1H');
      expect(ics).not.toContain('TRIGGER:-P1D');
    });

    it('emits only 1 day alarm when preference is 1day', () => {
      const ics = buildIcsEvent(
        {
          title: '1 Day Alarm',
          deadline: futureDeadline,
          uid: 'v-1d@disciplr.app',
          alarms: '1day',
        },
        { now: fixedNow }
      );
      expect(ics).toContain('TRIGGER:-P1D');
      expect(ics).not.toContain('TRIGGER:-PT1H');
    });

    it('emits both alarms when preference is both', () => {
      const ics = buildIcsEvent(
        {
          title: 'Both Alarms',
          deadline: futureDeadline,
          uid: 'v-both@disciplr.app',
          alarms: 'both',
        },
        { now: fixedNow }
      );
      expect(ics).toContain('TRIGGER:-P1D');
      expect(ics).toContain('TRIGGER:-PT1H');
    });

    it('does not emit alarms for deadlines in the past', () => {
      const pastDeadline = '2026-01-01T12:00:00Z'; // Before fixedNow (2026-06-01)
      const ics = buildIcsEvent(
        {
          title: 'Past Vault',
          deadline: pastDeadline,
          uid: 'v-past@disciplr.app',
          alarms: 'both',
        },
        { now: fixedNow }
      );
      expect(ics).toContain('SUMMARY:Past Vault');
      expect(ics).not.toContain('BEGIN:VALARM');
    });
  });

  describe('text escaping & CRLF injection prevention', () => {
    it('escapes ;, ,, \\ and newlines in vault names and descriptions', () => {
      const calendar = buildIcsEvent(
        {
          title: 'Alpha, Vault; Special \\ Edition',
          deadline: '2026-07-15T12:30:00Z',
          description: 'Line 1\r\nLine 2\nLine 3; with, chars\\done',
          uid: 'vault-1@disciplr.app',
        },
        { now: fixedNow }
      );

      expect(calendar).toContain('SUMMARY:Alpha\\, Vault\\; Special \\\\ Edition\r\n');
      expect(calendar).toContain('DESCRIPTION:Line 1\\nLine 2\\nLine 3\\; with\\, chars\\\\done\r\n');
    });

    it('prevents CRLF injection into new properties (e.g. \\r\\nATTENDEE:)', () => {
      const maliciousName = 'Innocent Name\r\nATTENDEE:mailto:hacker@example.com';
      const calendar = buildIcsEvent(
        {
          title: maliciousName,
          deadline: '2026-07-15T12:30:00Z',
          uid: 'vault-hacker@disciplr.app',
        },
        { now: fixedNow }
      );

      // The newline must be escaped as \n, so ATTENDEE is part of SUMMARY, not a standalone property
      expect(calendar).not.toMatch(/\r\nATTENDEE:/);
      expect(calendar).toContain('SUMMARY:Innocent Name\\nATTENDEE:mailto:hacker@example.com\r\n');
    });
  });

  describe('line folding with UTF-8 and surrogate pairs', () => {
    it('folds long lines at <= 75 octets without splitting UTF-16 surrogate pairs (emoji)', () => {
      // 🚀 is a 4-byte UTF-8 char and 2 UTF-16 code units (\uD83D\uDE80)
      const emojiTitle = `🚀 Rocket Launch ${'🎉'.repeat(30)} Vault ${'A'.repeat(100)}`;
      const line = `SUMMARY:${escapeIcsText(emojiTitle)}`;
      const folded = foldIcsLine(line);

      const splitLines = folded.split('\r\n');
      expect(splitLines.length).toBeGreaterThan(1);

      for (let i = 0; i < splitLines.length; i++) {
        const lineBytes = new TextEncoder().encode(splitLines[i]).length;
        expect(lineBytes).toBeLessThanOrEqual(75);
        if (i > 0) {
          expect(splitLines[i].startsWith(' ')).toBe(true);
        }
      }

      // Ensure no surrogate pair was split (which would result in lone surrogates)
      for (const singleLine of splitLines) {
        expect(() => singleLine.split('').map((c) => c.charCodeAt(0))).not.toThrow();
        // Check for unpaired surrogates
        for (let i = 0; i < singleLine.length; i++) {
          const code = singleLine.charCodeAt(i);
          if (code >= 0xd800 && code <= 0xdbff) {
            // High surrogate must be followed by low surrogate in the same line
            const nextCode = singleLine.charCodeAt(i + 1);
            expect(nextCode).toBeGreaterThanOrEqual(0xdc00);
            expect(nextCode).toBeLessThanOrEqual(0xdfff);
            i++; // skip low surrogate
          } else {
            expect(code < 0xdc00 || code > 0xdfff).toBe(true);
          }
        }
      }
    });
  });

  describe('batch deadline error handling', () => {
    it('skips invalid deadlines in a batch instead of throwing', () => {
      const events: IcsEventInput[] = [
        {
          title: 'Valid One',
          deadline: '2026-07-01T12:00:00Z',
          uid: 'v-1@disciplr.app',
        },
        {
          title: 'Broken Deadline',
          deadline: 'not-a-valid-date',
          uid: 'v-broken@disciplr.app',
        },
        {
          title: 'Valid Two',
          deadline: '2026-08-01T12:00:00Z',
          uid: 'v-2@disciplr.app',
        },
      ];

      expect(() => buildCalendar(events, { now: fixedNow })).not.toThrow();

      const output = buildCalendar(events, { now: fixedNow });
      expect(output).toContain('SUMMARY:Valid One');
      expect(output).toContain('SUMMARY:Valid Two');
      expect(output).not.toContain('Broken Deadline');
    });

    it('throws when single-event buildIcsEvent receives an invalid deadline', () => {
      expect(() =>
        buildIcsEvent({
          title: 'Broken',
          deadline: 'invalid-date',
          uid: 'v-broken@disciplr.app',
        })
      ).toThrow(/invalid deadline/i);
    });
  });

  describe('milestone events support', () => {
    it('emits one event per pending milestone with dueDate, plus vault deadline', () => {
      const vault: VaultLike = {
        id: 'vault-100',
        name: 'Quantum Project',
        amount: 50000,
        currency: 'USDC',
        deadline: '2026-12-31T00:00:00Z',
        milestones: [
          {
            id: 'm-1',
            title: 'Design Spec',
            description: 'Complete architecture design',
            status: 'pending',
            dueDate: '2026-09-30T12:00:00Z',
          },
          {
            id: 'm-2',
            title: 'Alpha Release',
            description: 'First release',
            status: 'pending',
            // No dueDate
          },
          {
            id: 'm-3',
            title: 'Security Audit',
            description: 'Already validated audit',
            status: 'validated',
            dueDate: '2026-10-15T12:00:00Z',
          },
        ],
      };

      const events = vaultToIcsEvents(vault);
      expect(events).toHaveLength(2);

      // Vault deadline event
      expect(events[0].title).toBe('Quantum Project deadline');
      expect(events[0].uid).toBe('vault-vault-100@disciplr.app');

      // Milestone event
      expect(events[1].title).toBe('Quantum Project - Design Spec');
      expect(events[1].deadline).toBe('2026-09-30T12:00:00Z');
      expect(events[1].uid).toBe('milestone-vault-100-m-1@disciplr.app');
    });

    it('emits only vault deadline when milestones have no due dates', () => {
      const vault: VaultLike = {
        id: 'vault-101',
        name: 'Simple Vault',
        deadline: '2026-11-30T00:00:00Z',
        milestones: [
          {
            id: 'm-1',
            title: 'Milestone 1',
            status: 'pending',
          },
        ],
      };

      const events = vaultToIcsEvents(vault);
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Simple Vault deadline');
    });
  });

  describe('download functions', () => {
    it('downloads single event and cleans up', () => {
      const res = downloadIcsEvent({
        title: 'Single Event',
        deadline: '2026-07-15T12:00:00Z',
        uid: 'v-1@disciplr.app',
      });

      expect(res).toBe(true);
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:deadline-calendar');
    });

    it('downloads multiple events as one calendar', () => {
      const res = downloadIcsCalendar(
        [
          { title: 'E1', deadline: '2026-07-01T10:00:00Z', uid: 'v-1@disciplr.app' },
          { title: 'E2', deadline: '2026-08-01T10:00:00Z', uid: 'v-2@disciplr.app' },
        ],
        'all.ics'
      );

      expect(res).toBe(true);
      expect(mockClick).toHaveBeenCalled();
    });

    it('returns false when no valid events exist to download', () => {
      const res = downloadIcsCalendar([
        { title: 'Bad', deadline: 'not-date', uid: 'v-bad@disciplr.app' },
      ]);
      expect(res).toBe(false);
      expect(mockClick).not.toHaveBeenCalled();
    });
  });
});
