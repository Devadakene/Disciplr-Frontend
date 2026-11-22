import { useState } from 'react';
import { CountdownDeadline, timeRemaining } from './CountdownDeadline';
import { Text } from './Text';
import { deadlineUrgency, type UrgencyTier } from '../utils/vaultUrgency';
import type { Deadline } from '../utils/dashboard';
import type { Vault } from '../types/vault';
import { formatUsdc } from '../utils/format';
import {
  downloadIcsEvent,
  downloadIcsCalendar,
  isValidIcsDeadline,
  vaultDeadlineUid,
  vaultToIcsEvents,
  type AlarmPreference,
  type IcsEventInput,
} from '../utils/ics';

interface UpcomingDeadlinesProps {
  deadlines: Deadline[];
  vaults?: Vault[];
}

function urgencyStyles(deadline: string) {
  const remaining = timeRemaining(deadline);

  if (remaining.tone === 'expired') {
    return {
      color: 'var(--danger)',
      background: 'var(--danger-transparent)',
      borderColor: 'var(--danger)',
      label: 'Expired',
    };
  }

  if (remaining.tone === 'invalid') {
    return {
      color: 'var(--muted)',
      background: 'var(--surface)',
      borderColor: 'var(--border)',
      label: 'Invalid',
    };
  }

  const urgency = deadlineUrgency(deadline);
  const config: Record<UrgencyTier, { color: string; background: string; borderColor: string; label: string }> = {
    critical: {
      color: 'var(--danger)',
      background: 'var(--danger-transparent)',
      borderColor: 'var(--danger)',
      label: 'Critical',
    },
    soon: {
      color: 'var(--warning)',
      background: 'var(--warning-transparent)',
      borderColor: 'var(--warning)',
      label: 'Soon',
    },
    safe: {
      color: 'var(--success)',
      background: 'var(--success-transparent)',
      borderColor: 'var(--success)',
      label: 'Safe',
    },
    expired: {
      color: 'var(--danger)',
      background: 'var(--danger-transparent)',
      borderColor: 'var(--danger)',
      label: 'Expired',
    },
  };

  return config[urgency];
}

function remainingTimeSort(deadline: string) {
  const deadlineMs = new Date(deadline).getTime();
  return Number.isNaN(deadlineMs) ? Number.POSITIVE_INFINITY : deadlineMs - Date.now();
}

export default function UpcomingDeadlines({ deadlines, vaults }: UpcomingDeadlinesProps) {
  const [alarmPreference, setAlarmPreference] = useState<AlarmPreference>('both');

  const sortedDeadlines = [...deadlines].sort(
    (a, b) => remainingTimeSort(a.deadline) - remainingTimeSort(b.deadline)
  );

  const activeVaults = vaults?.filter(
    (v) => v.status === 'active' || v.status === 'pending_validation'
  );

  const hasVaultsProp = vaults !== undefined && vaults.length > 0;
  const isExportDisabled = hasVaultsProp
    ? !activeVaults || activeVaults.length === 0
    : deadlines.length === 0;

  const handleExportAll = () => {
    let events: IcsEventInput[] = [];

    if (hasVaultsProp && activeVaults && activeVaults.length > 0) {
      events = activeVaults.flatMap((v) => vaultToIcsEvents(v, alarmPreference));
    } else {
      events = deadlines
        .filter((d) => isValidIcsDeadline(d.deadline))
        .map((d) => ({
          title: `${d.name} deadline`,
          deadline: d.deadline,
          description: `Vault deadline: ${d.amount.toLocaleString()} USDC`,
          uid: vaultDeadlineUid(d.id),
          vaultId: d.id,
          alarms: alarmPreference,
        }));
    }

    if (events.length > 0) {
      downloadIcsCalendar(events, 'disciplr-all-deadlines.ics', {
        alarms: alarmPreference,
        calendarName: 'Disciplr deadlines',
      });
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <Text role="body" as="h2" style={{ margin: 0, fontWeight: 600 }}>
            Upcoming Deadlines
          </Text>
        </div>

        {/* Calendar Export Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <select
            aria-label="Alarm preference"
            value={alarmPreference}
            onChange={(e) => setAlarmPreference(e.target.value as AlarmPreference)}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '4px 8px',
              fontSize: 12,
              color: 'var(--text)',
              cursor: 'pointer',
              flex: '1 1 auto',
              minWidth: '130px',
            }}
          >
            <option value="both">Both (1 day & 1 hr)</option>
            <option value="1day">1 day before</option>
            <option value="1hour">1 hour before</option>
            <option value="none">No alarms</option>
          </select>
          <button
            type="button"
            onClick={handleExportAll}
            disabled={isExportDisabled}
            aria-label="Export all deadlines (.ics)"
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--accent)',
              color: 'var(--bg)',
              cursor: isExportDisabled ? 'not-allowed' : 'pointer',
              opacity: isExportDisabled ? 0.4 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            Export all deadlines (.ics)
          </button>
        </div>
      </div>

      {sortedDeadlines.length === 0 ? (
        <Text role="caption" as="div" style={{ color: 'var(--muted)' }}>
          No upcoming deadlines.
        </Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sortedDeadlines.map((item) => {
            const styles = urgencyStyles(item.deadline);

            return (
              <div
                key={item.id}
                data-testid={`upcoming-deadline-${item.id}`}
                style={{
                  background: 'var(--bg)',
                  border: `1px solid ${styles.borderColor}`,
                  borderLeft: `3px solid ${styles.borderColor}`,
                  borderRadius: 'var(--radius)',
                  padding: '0.75rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 2,
                  }}
                >
                  <Text role="caption" as="div" style={{ fontWeight: 600 }}>
                    {item.name}
                  </Text>
                  <span
                    style={{
                      color: styles.color,
                      background: styles.background,
                      border: `1px solid ${styles.borderColor}`,
                      borderRadius: 'var(--radius-full)',
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      padding: '2px 8px',
                    }}
                  >
                    {styles.label}
                  </span>
                </div>
                <Text role="caption" as="div" style={{ color: 'var(--muted)', marginBottom: 2 }}>
                  {formatUsdc(item.amount)} USDC
                </Text>
                <CountdownDeadline deadline={item.deadline} />
                <button
                  type="button"
                  onClick={() =>
                    downloadIcsEvent({
                      title: `${item.name} deadline`,
                      deadline: item.deadline,
                      description: `Vault deadline: ${item.amount.toLocaleString()} USDC`,
                      uid: vaultDeadlineUid(item.id),
                      vaultId: item.id,
                      alarms: alarmPreference,
                    })
                  }
                  disabled={!isValidIcsDeadline(item.deadline)}
                  aria-label={`Export ${item.name} deadline to calendar`}
                  style={{
                    marginTop: '0.5rem',
                    padding: '3px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    cursor: isValidIcsDeadline(item.deadline) ? 'pointer' : 'not-allowed',
                    opacity: isValidIcsDeadline(item.deadline) ? 1 : 0.4,
                  }}
                >
                  Add to Calendar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
