import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text } from "@/components/Text";
import { Switch } from "../components/Switch";
import { useNotificationPreferences } from "../Zustand/Store";
import { useWallet } from "../context/WalletContext";
import { listVaults } from "../services/vaultService";
import type { Vault } from "../types/vault";
import { isValidQuietHoursRange, isQuietHoursActive } from "../utils/quietHours";
import {
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "../notifications/delivery";


// Allowed notification frequency values. Anything outside this set is rejected
// so a stale or tampered persisted value cannot silently change behavior.
const ALLOWED_FREQUENCIES = ["1", "2", "3", "4"] as const;
type Frequency = (typeof ALLOWED_FREQUENCIES)[number];

const isAllowedFrequency = (value: unknown): value is Frequency =>
  typeof value === "string" && (ALLOWED_FREQUENCIES as readonly string[]).includes(value);

export default function NotificationSettings() {
  const { address } = useWallet();
  const {
    email: emailNotification,
    push: pushNotification,
    frequency,
    quietHours,
    setEmail: setEmailNotification,
    setPush: setPushNotification,
    setFrequency,
    setQuietHours,
    vaultOverrides,
    setVaultOverride,
    pruneVaultOverrides,
    reset,
  } = useNotificationPreferences();

  // Authorization/validation invariant: the persisted frequency must be one of
  // the known options. If it is not (stale state, tampering, partial write),
  // fall back to a safe default rather than rendering an invalid selection.
  const safeFrequency: Frequency = isAllowedFrequency(frequency) ? frequency : "1";
  const frequencyIsValid = isAllowedFrequency(frequency);

  const [quietDraft, setQuietDraft] = useState<{ start: string; end: string } | null>(null);
  const quietStartValue = quietDraft?.start ?? quietHours.start;
  const quietEndValue = quietDraft?.end ?? quietHours.end;
  const quietRangeIsValid = isValidQuietHoursRange(quietStartValue, quietEndValue);
  useEffect(() => {
    setQuietDraft(null);
  }, [quietHours.start, quietHours.end]);
  const quietHoursActive = useMemo(
    () => quietHours.enabled && isQuietHoursActive(new Date(), quietStartValue, quietEndValue),
    [quietHours.enabled, quietStartValue, quietEndValue]
  );

  function updateQuietRange(start: string, end: string) {
    setQuietDraft({ start, end });
    if (isValidQuietHoursRange(start, end)) {
      setQuietHours({ ...quietHours, start, end });
      setQuietDraft(null);
    }
  }

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [vaultsLoading, setVaultsLoading] = useState(true);
  const [vaultsError, setVaultsError] = useState(false);

  useEffect(() => {
    let active = true;
    setVaultsLoading(true);
    setVaultsError(false);
    listVaults().then((items) => {
      if (!active) return;
      pruneVaultOverrides(items.map((vault) => vault.id));
      setVaults(items.filter((vault) =>
        !address || vault.creatorAddress === address || vault.verifierAddress === address,
      ));
      setVaultsLoading(false);
    }).catch(() => {
      if (!active) return;
      setVaultsError(true);
      setVaultsLoading(false);
    });
    return () => { active = false; };
  }, [address, pruneVaultOverrides]);

  const handleFrequencyChange = useCallback(
    (value: string) => {
      if (!isAllowedFrequency(value)) return;
      setFrequency(value);
    },
    [setFrequency]
  );

  // Push delivery only works with the browser's permission, so enabling the
  // switch is a permission request rather than a plain preference write. The
  // stored flag is only set to true once the browser has actually granted
  // access; a denial reverts the switch and explains how to undo it.
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const notificationsSupported = permission !== "unsupported";
  const [pushHint, setPushHint] = useState<string | null>(
    notificationsSupported
      ? null
      : "This browser does not support desktop notifications, so push delivery is unavailable."
  );
  const [permissionPending, setPermissionPending] = useState(false);

  const handlePushChange = useCallback(
    async (checked: boolean) => {
      if (!checked) {
        setPushNotification(false);
        setPushHint(null);
        return;
      }
      // Guard against a second prompt while the first is still open.
      if (permissionPending) return;
      setPermissionPending(true);
      try {
        const result = await requestNotificationPermission();
        setPermission(result);
        if (result === "granted") {
          setPushNotification(true);
          setPushHint(null);
          return;
        }
        setPushNotification(false);
        setPushHint(
          result === "unsupported"
            ? "This browser does not support desktop notifications, so push delivery is unavailable."
            : "Desktop notifications are blocked for this site. Allow them in your browser's site settings, then turn Push Notification back on."
        );
      } finally {
        setPermissionPending(false);
      }
    },
    [permissionPending, setPushNotification]
  );

  function handleReset() {
    setQuietDraft(null);
    reset();
  }

  return (
    <>
      <div 
        className="w-full rounded-md px-3 py-3 notification-settings-panel"
        style={{ zIndex: 'var(--z-index-base)' }}
      >
        <Text role="title" as="h2">Notification Settings</Text>
        <div>
          <div className="grid grid-cols-2 justify-center items-center mt-5">
            <Text role="body" as="p">
              Email Notification
            </Text>
            <div className="flex flex-col items-end justify-end gap-4">
              <Switch
                label="Email Notification"
                checked={emailNotification ?? false}
                onChange={setEmailNotification}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 justify-center items-center mt-5">
            <Text role="body" as="p">
              Push Notification
            </Text>
            <div className="flex flex-col items-end justify-end gap-4">
              <Switch
                label="Push Notification"
                checked={pushNotification ?? false}
                onChange={handlePushChange}
                disabled={!notificationsSupported}
              />
              {pushHint !== null && (
                <p
                  className="notification-settings-hint"
                  role="status"
                  data-testid="push-notification-hint"
                >
                  {pushHint}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center mt-5">
            <label htmlFor="notification-frequency">
              <Text role="body" as="span">
                Notification Frequency
              </Text>
            </label>
            <select
              className="w-[200px] notification-settings-field"
              value={safeFrequency}
              onChange={(e) => handleFrequencyChange(e.target.value)}
              name="notification-frequency"
              id="notification-frequency"
              aria-invalid={!frequencyIsValid}
            >
              <option value="" disabled hidden>Not set</option>
              <option value="1">Occurrence</option>
              <option value="2">Daily</option>
              <option value="3">Weekly</option>
              <option value="4">Never</option>
            </select>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between gap-4">
              <Text role="body" as="span">
                Quiet Hours
              </Text>
              <Switch
                label="Enable Quiet Hours"
                checked={quietHours.enabled}
                onChange={(enabled) => setQuietHours({ ...quietHours, enabled })}
              />
              <span
                className={`notification-settings-badge ${
                  quietHoursActive
                    ? "notification-settings-badge-active"
                    : "notification-settings-badge-inactive"
                }`}
                aria-live="polite"
              >
                {quietHoursActive
                  ? "Quiet hours active now"
                  : "Quiet hours inactive"}
              </span>
            </div>
            <div className="mt-3">
              <label className="flex flex-col gap-1" htmlFor="quiet-start">
                <input
                  className="notification-settings-field"
                  type="time"
                  id="quiet-start"
                  aria-label="Quiet Hours Start"
                  aria-invalid={!quietRangeIsValid}
                  value={quietStartValue}
                  onChange={(e) => updateQuietRange(e.target.value, quietEndValue)}
                />
              </label>
              <label className="flex flex-col gap-1 mt-2" htmlFor="quiet-end">
                <input
                  className="notification-settings-field"
                  type="time"
                  id="quiet-end"
                  aria-label="Quiet Hours End"
                  aria-invalid={!quietRangeIsValid}
                  value={quietEndValue}
                  onChange={(e) => updateQuietRange(quietStartValue, e.target.value)}
                />
              </label>
              {!quietRangeIsValid && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  Start and end times must be different.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end items-center mt-5">
            <button
              className="px-4 py-2 font-medium rounded transition notification-settings-reset"
              onClick={handleReset}
            >
              Reset Preferences
            </button>
          </div>
        </div>
      </div>

      <div 
        className="w-full rounded-md px-3 py-3 mt-5 notification-settings-panel"
        style={{ zIndex: 'var(--z-index-base)' }}
      >
        <Text role="title" as="h2">Vault Notifications</Text>
        {vaultsLoading && <p role="status" className="mt-5">Loading vaults...</p>}
        {vaultsError && <p role="alert" className="mt-5">Vaults could not be loaded.</p>}
        {!vaultsLoading && !vaultsError && vaults.length === 0 && (
          <p className="mt-5">No vaults found.</p>
        )}
        {!vaultsLoading && !vaultsError && vaults.map((v) => (
          <div
            className="grid grid-cols-2 justify-center items-center mt-5"
            key={v.id}
          >
            <Text role="body" as="p">
              {v.name}
            </Text>
            <div className="flex flex-col items-end justify-end gap-4">
              <Switch
                label={`${v.name} notifications`}
                checked={vaultOverrides[v.id] ?? false}
                onChange={(checked) => setVaultOverride(v.id, checked)}
              />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .notification-settings-panel {
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .notification-settings-field {
          background: var(--surface-raised);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: var(--spacing-1) var(--spacing-2);
        }

        .notification-settings-field:focus {
          border-color: var(--accent);
          outline: 2px solid var(--accent-transparent);
          outline-offset: 2px;
        }

        .notification-settings-reset {
          background: var(--surface-raised);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          cursor: pointer;
        }

        .notification-settings-reset:hover {
          background: var(--border);
        }

        .notification-settings-hint {
          max-width: 260px;
          text-align: right;
          font-size: 0.75rem;
          line-height: 1.4;
          color: var(--muted);
        }

      `}</style>
    </>
  );
}
