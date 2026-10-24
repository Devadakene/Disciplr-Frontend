export type AlarmPreference = 'none' | '1hour' | '1day' | 'both';

export interface IcsEventInput {
  title: string;
  deadline: string;
  description?: string;
  uid: string;
  vaultId?: string;
  sequence?: number;
  url?: string;
  alarms?: AlarmPreference;
}

export type IcsEvent = IcsEventInput;

export interface IcsCalendarOptions {
  now?: Date;
  calendarName?: string;
  alarms?: AlarmPreference;
  origin?: string;
}

export interface MilestoneLike {
  id: string;
  title: string;
  description?: string;
  status: string;
  dueDate?: string;
  deadline?: string;
}

export interface VaultLike {
  id: string;
  name: string;
  amount?: number;
  currency?: string;
  deadline: string;
  milestones?: MilestoneLike[];
}

const CRLF = '\r\n';
const DEFAULT_DURATION = 'PT30M';
const PROD_ID = '-//Disciplr//Vault Deadline//EN';

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

export function isValidIcsDeadline(deadline: string): boolean {
  return isValidDate(new Date(deadline));
}

export function formatIcsDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('');
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }

  return value.length;
}

export function foldIcsLine(line: string): string {
  const lines: string[] = [];
  let remaining = line;

  while (byteLength(remaining) > 75) {
    let splitAt = 0;
    let bytes = 0;

    for (const char of remaining) {
      const nextBytes = bytes + byteLength(char);
      if (nextBytes > 75) break;
      bytes = nextBytes;
      splitAt += char.length;
    }

    if (splitAt === 0) break;

    lines.push(remaining.slice(0, splitAt));
    remaining = ` ${remaining.slice(splitAt)}`;
  }

  lines.push(remaining);
  return lines.join(CRLF);
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function icsFilename(title: string, uid: string): string {
  const base = sanitizeFilenamePart(title) || sanitizeFilenamePart(uid) || 'vault-deadline';
  return `${base}.ics`;
}

export function vaultDeadlineUid(
  vaultId: string,
  milestoneId?: string,
  kind: string = milestoneId ? 'milestone' : 'vault'
): string {
  if (milestoneId) {
    return `${kind}-${vaultId}-${milestoneId}@disciplr.app`;
  }
  return `${kind}-${vaultId}@disciplr.app`;
}

export function getDeadlineSequence(deadline: string): number {
  const date = new Date(deadline);
  if (!isValidDate(date)) return 0;
  return Math.floor(date.getTime() / 1000);
}

function resolveOrigin(customOrigin?: string): string | undefined {
  const raw = customOrigin ?? (typeof window !== 'undefined' ? window.location?.origin : undefined);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // Ignore invalid origin
  }
  return undefined;
}

function buildValarmBlock(title: string, trigger: string): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(title)}`,
    `TRIGGER:${trigger}`,
    'END:VALARM',
  ];
}

export function vaultToIcsEvents(vault: VaultLike, alarms?: AlarmPreference): IcsEventInput[] {
  const events: IcsEventInput[] = [];

  if (isValidIcsDeadline(vault.deadline)) {
    const desc =
      vault.amount != null
        ? `${vault.name} vault deadline for ${vault.amount.toLocaleString()} ${vault.currency || 'USDC'}.`
        : `${vault.name} deadline.`;

    events.push({
      title: `${vault.name} deadline`,
      deadline: vault.deadline,
      description: desc,
      uid: vaultDeadlineUid(vault.id),
      vaultId: vault.id,
      alarms,
    });
  }

  if (Array.isArray(vault.milestones)) {
    for (const m of vault.milestones) {
      const milestoneDueDate = m.dueDate || m.deadline;
      if (m.status === 'pending' && milestoneDueDate && isValidIcsDeadline(milestoneDueDate)) {
        events.push({
          title: `${vault.name} - ${m.title}`,
          deadline: milestoneDueDate,
          description: m.description || `Milestone for ${vault.name}`,
          uid: vaultDeadlineUid(vault.id, m.id),
          vaultId: vault.id,
          alarms,
        });
      }
    }
  }

  return events;
}

export function buildCalendar(events: IcsEventInput[], opts: IcsCalendarOptions = {}): string {
  const now = opts.now ?? new Date();
  const origin = resolveOrigin(opts.origin);

  const validEvents = events.filter((e) => isValidIcsDeadline(e.deadline));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  if (opts.calendarName || validEvents.length > 1) {
    lines.push(`X-WR-CALNAME:${escapeIcsText(opts.calendarName ?? 'Disciplr deadlines')}`);
  }

  for (const event of validEvents) {
    const deadlineDate = new Date(event.deadline);
    const sequence = event.sequence !== undefined ? event.sequence : getDeadlineSequence(event.deadline);

    let eventUrl = event.url;
    if (!eventUrl && event.vaultId) {
      eventUrl = `/vaults/${event.vaultId}`;
    } else if (!eventUrl) {
      const match = event.uid.match(/^(?:vault|milestone)-([a-zA-Z0-9_-]+)(?:-[a-zA-Z0-9_-]+)?@disciplr\.app$/);
      if (match) {
        eventUrl = `/vaults/${match[1]}`;
      }
    }

    let urlLine: string | undefined;
    if (eventUrl) {
      if (/^https?:\/\//i.test(eventUrl)) {
        urlLine = `URL:${escapeIcsText(eventUrl)}`;
      } else if (origin) {
        const cleanPath = eventUrl.startsWith('/') ? eventUrl : `/${eventUrl}`;
        urlLine = `URL:${origin}${cleanPath}`;
      }
    }

    const effectiveAlarm = event.alarms ?? opts.alarms ?? 'both';
    const isPast = deadlineDate.getTime() < now.getTime();
    const alarmLines: string[] = [];

    if (!isPast && effectiveAlarm !== 'none') {
      if (effectiveAlarm === '1day' || effectiveAlarm === 'both') {
        alarmLines.push(...buildValarmBlock(event.title, '-P1D'));
      }
      if (effectiveAlarm === '1hour' || effectiveAlarm === 'both') {
        alarmLines.push(...buildValarmBlock(event.title, '-PT1H'));
      }
    }

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeIcsText(event.uid)}`);
    lines.push(`DTSTAMP:${formatIcsDate(now)}`);
    lines.push(`DTSTART:${formatIcsDate(deadlineDate)}`);
    lines.push(`DURATION:${DEFAULT_DURATION}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description !== undefined && event.description !== '') {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    lines.push('STATUS:CONFIRMED');
    lines.push(`SEQUENCE:${sequence}`);
    if (urlLine) {
      lines.push(urlLine);
    }
    if (alarmLines.length > 0) {
      lines.push(...alarmLines);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`;
}

export function buildIcsEvent(input: IcsEventInput, opts: IcsCalendarOptions = {}): string {
  const deadlineDate = new Date(input.deadline);
  if (!isValidDate(deadlineDate)) {
    throw new Error('Cannot build calendar event for an invalid deadline.');
  }

  return buildCalendar([input], opts);
}

export function downloadIcs(calendar: string, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;

  const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadIcsCalendar(
  events: IcsEventInput[],
  filename = 'disciplr-deadlines.ics',
  opts?: IcsCalendarOptions
): boolean {
  const valid = events.filter((e) => isValidIcsDeadline(e.deadline));
  if (valid.length === 0) return false;

  downloadIcs(buildCalendar(valid, opts), filename);
  return true;
}

export function downloadIcsEvent(input: IcsEventInput, opts?: IcsCalendarOptions): boolean {
  if (!isValidIcsDeadline(input.deadline)) return false;

  downloadIcs(buildIcsEvent(input, opts), icsFilename(input.title, input.uid));
  return true;
}
