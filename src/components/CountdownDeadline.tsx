import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Text } from './Text';
import { formatDateTime } from '../utils/format';

export type DeadlineTone = 'normal' | 'urgent' | 'expired' | 'invalid';

export interface TimeRemainingResult {
  tone: DeadlineTone;
  label: string;
  msRemaining: number;
  absoluteLabel: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function timeRemaining(deadline: string, now: Date | number = Date.now()): TimeRemainingResult {
  const deadlineDate = new Date(deadline);
  const deadlineMs = deadlineDate.getTime();
  const nowMs = typeof now === 'number' ? now : now.getTime();

  if (Number.isNaN(deadlineMs)) {
    return {
      tone: 'invalid',
      label: 'Invalid deadline',
      msRemaining: 0,
      absoluteLabel: 'Invalid deadline',
    };
  }

  const msRemaining = deadlineMs - nowMs;
  const absoluteLabel = formatDateTime(deadlineDate);

  if (msRemaining <= 0) {
    return {
      tone: 'expired',
      label: 'Overdue',
      msRemaining,
      absoluteLabel,
    };
  }

  const days = Math.floor(msRemaining / DAY_MS);
  const hours = Math.floor((msRemaining % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((msRemaining % HOUR_MS) / 60000);

  if (days > 0) {
    return {
      tone: 'normal',
      label: `${days}d ${hours}h remaining`,
      msRemaining,
      absoluteLabel,
    };
  }

  return {
    tone: 'urgent',
    label: hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`,
    msRemaining,
    absoluteLabel,
  };
}

interface CountdownDeadlineProps {
  deadline: string;
  intervalMs?: number;
  prefix?: string;
  style?: CSSProperties;
  onExpire?: () => void;
}

export function CountdownDeadline({
  deadline,
  intervalMs = 60000,
  prefix,
  style,
  onExpire,
}: CountdownDeadlineProps) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = timeRemaining(deadline, now);
  const color = {
    normal: 'var(--muted)',
    urgent: 'var(--warning)',
    expired: 'var(--danger)',
    invalid: 'var(--danger)',
  }[remaining.tone];

  const firedRef = useRef(remaining.tone === 'expired');

  useEffect(() => {
    if (remaining.tone === 'expired' && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining.tone]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return (
    <Text
      role="caption"
      as="span"
      aria-label={`Deadline ${remaining.absoluteLabel}. ${remaining.label}`}
      aria-live="off"
      data-tone={remaining.tone}
      title={remaining.absoluteLabel}
      style={{
        color,
        fontWeight: 600,
        ...style,
      }}
    >
      {prefix ? `${prefix} ${remaining.label}` : remaining.label}
    </Text>
  );
}
