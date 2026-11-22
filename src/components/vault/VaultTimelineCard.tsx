import { useState } from "react";
import { CountdownDeadline } from "../CountdownDeadline";
import { StatusChip } from "../StatusChip";
import { Text } from "../Text";
import { VaultLifecycle } from "../VaultLifecycle";
import { VaultProgressBar } from "../VaultProgressBar";
import { formatDate } from "../../utils/format";
import {
  downloadIcsCalendar,
  icsFilename,
  isValidIcsDeadline,
  vaultDeadlineUid,
  vaultToIcsEvents,
  type AlarmPreference,
} from "../../utils/ics";
import { timelineProgress } from "../../utils/vaultLifecycle";
import type { Vault } from "../../types/vault";
import { VaultCard } from "./VaultCard";
import "./vaultDetail.css";

export interface VaultTimelineCardProps {
  vault: Vault;
  isActive: boolean;
}

export function VaultTimelineCard({ vault, isActive }: VaultTimelineCardProps) {
  const progress = timelineProgress(vault.createdAt, vault.deadline);
  const canExportDeadline = isValidIcsDeadline(vault.deadline);
  const [alarmPreference, setAlarmPreference] =
    useState<AlarmPreference>("both");

  const handleCalendarExport = () => {
    const events = vaultToIcsEvents(vault, alarmPreference);
    downloadIcsCalendar(
      events,
      icsFilename(`${vault.name} deadline`, vaultDeadlineUid(vault.id)),
      { alarms: alarmPreference },
    );
  };

  return (
    <VaultCard className="vault-card--spaced">
      <Text role="caption" as="div" className="vault-section-heading">
        Status Timeline
      </Text>
      <VaultProgressBar
        value={progress}
        label={`${vault.name} timeline progress`}
        showValue={false}
      />
      <VaultLifecycle status={vault.status} />
      <div className="vault-timeline__meta">
        <Text role="caption" as="span" className="vault-timeline__muted">
          Created {formatDate(vault.createdAt)}
        </Text>
        {isActive ? (
          <CountdownDeadline deadline={vault.deadline} />
        ) : (
          <StatusChip status={vault.status} />
        )}
        <div className="vault-timeline__deadline-group">
          <Text role="caption" as="span" className="vault-timeline__muted">
            Deadline {formatDate(vault.deadline)}
          </Text>
          {canExportDeadline ? (
            <div className="vault-timeline__calendar-controls">
              <select
                aria-label="Alarm preference"
                value={alarmPreference}
                onChange={(e) =>
                  setAlarmPreference(e.target.value as AlarmPreference)
                }
                className="vault-timeline__alarm-select"
              >
                <option value="both">Alarms: 1 day & 1 hour</option>
                <option value="1day">1 day before</option>
                <option value="1hour">1 hour before</option>
                <option value="none">No alarms</option>
              </select>
              <button
                type="button"
                onClick={handleCalendarExport}
                className="vault-btn"
              >
                Add to calendar
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </VaultCard>
  );
}
