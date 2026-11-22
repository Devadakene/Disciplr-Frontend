import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { BoundaryError } from "./boundaryErrors";
import {
  getSession,
  sessionKey,
  type SessionSnapshot,
} from "./sessionBoundary";
import { parseServerPayload, validate } from "./validateMiddleware";
import { isValidQuietHoursRange } from "../utils/quietHours";
import { isValidVaultRouteId } from "../utils/vaultState";

export const VALID_FREQUENCIES = ["1", "2", "3", "4"] as const;
export type NotificationFrequency = (typeof VALID_FREQUENCIES)[number];

export type QuietHoursPreference = {
  enabled: boolean;
  start: string;
  end: string;
};

export const PREFERENCE_DEFAULTS = {
  email: true,
  push: false,
  frequency: "1" as NotificationFrequency,
  quietHours: { enabled: false, start: "22:00", end: "07:00" } as QuietHoursPreference,
  vaultOverrides: {} as Record<string, boolean>,
};

export type PreferenceFields = {
  email: boolean;
  push: boolean;
  frequency: string;
  quietHours: QuietHoursPreference;
  vaultOverrides: Record<string, boolean>;
};

export type NotificationPreferencesState = PreferenceFields & {
  ownerKey: string | null;
  lastNonce: string | null;
  setEmail: (value: boolean) => void;
  setPush: (value: boolean) => void;
  setFrequency: (value: string) => void;
  setQuietHours: (value: QuietHoursPreference) => void;
  setVaultOverride: (vaultId: string, enabled: boolean) => void;
  pruneVaultOverrides: (validVaultIds: string[]) => void;
  reset: () => void;
  applyFromServer: (payload: unknown, nonce: string) => void;
};

const ALLOWED_PARTIAL_KEYS = new Set([
  "email",
  "push",
  "frequency",
  "quietHours",
  "vaultOverrides",
  "ownerKey",
  "lastNonce",
  "reset",
]);

function isFrequency(value: unknown): value is NotificationFrequency {
  return (
    typeof value === "string" &&
    (VALID_FREQUENCIES as readonly string[]).includes(value)
  );
}

function isQuietHoursPreference(value: unknown): value is QuietHoursPreference {
  if (!value || typeof value !== "object") return false;
  const hours = value as Record<string, unknown>;
  return (
    typeof hours.enabled === "boolean" &&
    typeof hours.start === "string" &&
    typeof hours.end === "string" &&
    isValidQuietHoursRange(hours.start, hours.end)
  );
}

function sanitizeVaultOverrides(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 200) return null;
  const overrides: Record<string, boolean> = {};
  for (const [vaultId, enabled] of entries) {
    if (!isValidVaultRouteId(vaultId) || typeof enabled !== "boolean") {
      return null;
    }
    overrides[vaultId] = enabled;
  }
  return overrides;
}

export function sanitizePreferenceFields(
  input: unknown,
): PreferenceFields | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  if (typeof rec.email !== "boolean") return null;
  if (typeof rec.push !== "boolean") return null;
  if (!isFrequency(rec.frequency)) return null;
  if (!isQuietHoursPreference(rec.quietHours)) {
    return null;
  }
  const vaultOverrides = sanitizeVaultOverrides(rec.vaultOverrides);
  if (!vaultOverrides) return null;
  return {
    email: rec.email,
    push: rec.push,
    frequency: rec.frequency,
    quietHours: { ...rec.quietHours },
    vaultOverrides,
  };
}

function assertOwnerMatches(session: SessionSnapshot, ownerKey: string | null) {
  if (!session.address) return;
  const live = sessionKey(session);
  if (ownerKey && ownerKey !== live) {
    throw new BoundaryError(
      "UNAUTHORIZED",
      "Preference state is owned by a different wallet session.",
      { ownerKey, live },
    );
  }
}

function assertSessionConnected(session: SessionSnapshot) {
  if (!session.address || !session.network) {
    throw new BoundaryError(
      "DISCONNECTED_WALLET",
      "Cannot apply server preferences without a connected wallet.",
    );
  }
}

function validatePrefsPartial({
  current,
  next,
  session,
}: {
  current: NotificationPreferencesState;
  next: NotificationPreferencesState | Partial<NotificationPreferencesState>;
  session: SessionSnapshot;
}): Partial<NotificationPreferencesState> {
  const partial = next as Partial<NotificationPreferencesState>;
  for (const key of Object.keys(partial)) {
    if (!ALLOWED_PARTIAL_KEYS.has(key)) {
      throw new BoundaryError(
        "TAMPERED_INPUT",
        `Unexpected preference field "${key}".`,
      );
    }
  }

  if ("email" in partial && typeof partial.email !== "boolean") {
    throw new BoundaryError("TAMPERED_INPUT", "email must be a boolean.");
  }
  if ("push" in partial && typeof partial.push !== "boolean") {
    throw new BoundaryError("TAMPERED_INPUT", "push must be a boolean.");
  }
  if ("frequency" in partial && !isFrequency(partial.frequency)) {
    throw new BoundaryError(
      "TAMPERED_INPUT",
      "frequency must be one of 1, 2, 3, 4.",
    );
  }
  if (
    "quietHours" in partial &&
    !isQuietHoursPreference(partial.quietHours)
  ) {
    throw new BoundaryError(
      "TAMPERED_INPUT",
      "quietHours must contain an enabled flag and a valid, non-empty HH:MM range.",
    );
  }
  if (
    "vaultOverrides" in partial &&
    !sanitizeVaultOverrides(partial.vaultOverrides)
  ) {
    throw new BoundaryError(
      "TAMPERED_INPUT",
      "vaultOverrides must contain at most 200 valid vault ids and boolean values.",
    );
  }

  assertOwnerMatches(session, current.ownerKey);
  if ("lastNonce" in partial) {
    if (
      partial.lastNonce !== null &&
      (typeof partial.lastNonce !== "string" ||
        partial.lastNonce.length === 0)
    ) {
      throw new BoundaryError(
        "TAMPERED_INPUT",
        "lastNonce must be a non-empty string or null.",
      );
    }
  }
  if ("ownerKey" in partial) {
    if (
      partial.ownerKey !== null &&
      typeof partial.ownerKey !== "string"
    ) {
      throw new BoundaryError(
        "TAMPERED_INPUT",
        "ownerKey must be a string or null.",
      );
    }
    if (session.address && partial.ownerKey) {
      const live = sessionKey(session);
      if (partial.ownerKey !== live) {
        throw new BoundaryError(
          "UNAUTHORIZED",
          "ownerKey does not match the active session.",
        );
      }
    }
  }

  const liveKey = session.address ? sessionKey(session) : current.ownerKey;
  return {
    ...partial,
    ownerKey: liveKey ?? current.ownerKey,
  };
}

export function migratePreferenceState(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== "object" || version !== 0) return persisted;
  const legacy = persisted as Record<string, unknown>;
  return {
    email: legacy.email,
    push: legacy.push,
    frequency: legacy.frequency,
    quietHours: typeof legacy.quietHours === "string"
      ? { enabled: true, start: legacy.quietHours, end: "07:00" }
      : legacy.quietHours,
    vaultOverrides: {},
    ownerKey: legacy.ownerKey,
    lastNonce: legacy.lastNonce,
  };
}

const memoryStorage = new Map<string, string>();
const safePreferenceStorage: StateStorage = {
  getItem: (name) => {
    try {
      const stored = typeof window === "undefined" ? null : window.localStorage.getItem(name);
      return stored ?? memoryStorage.get(name) ?? null;
    } catch {
      return memoryStorage.get(name) ?? null;
    }
  },
  setItem: (name, value) => {
    memoryStorage.set(name, value);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(name, value);
    } catch {
      // Preserve the in-memory preference when browser storage is unavailable.
    }
  },
  removeItem: (name) => {
    memoryStorage.delete(name);
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(name);
    } catch {
      // The in-memory copy has already been removed.
    }
  },
};

export const useNotificationPreferences = create<NotificationPreferencesState>()(
  persist(
    validate(
      (set, get) => ({
        ...PREFERENCE_DEFAULTS,
        ownerKey: null,
        lastNonce: null,
        setEmail: (value) => set({ email: value }),
        setPush: (value) => set({ push: value }),
        setFrequency: (value) => set({ frequency: value }),
        setQuietHours: (value) => set({ quietHours: value }),
        setVaultOverride: (vaultId, enabled) => {
          if (!isValidVaultRouteId(vaultId) || typeof enabled !== "boolean") {
            throw new BoundaryError("TAMPERED_INPUT", "Invalid vault override.");
          }
          const overrides = get().vaultOverrides;
          if (!Object.prototype.hasOwnProperty.call(overrides, vaultId) && Object.keys(overrides).length >= 200) {
            throw new BoundaryError("TAMPERED_INPUT", "At most 200 vault overrides are allowed.");
          }
          set({ vaultOverrides: { ...overrides, [vaultId]: enabled } });
        },
        pruneVaultOverrides: (validVaultIds) => {
          const validIds = new Set(validVaultIds.filter(isValidVaultRouteId));
          const overrides = get().vaultOverrides;
          const next = Object.fromEntries(Object.entries(overrides).filter(([id]) => validIds.has(id)));
          if (Object.keys(next).length !== Object.keys(overrides).length) set({ vaultOverrides: next });
        },
        reset: () =>
          set({
            ...PREFERENCE_DEFAULTS,
            ownerKey: getSession().address ? sessionKey() : get().ownerKey,
            lastNonce: null,
          }),
        applyFromServer: (payload, nonce) => {
          if (typeof nonce !== "string" || nonce.length === 0) {
            throw new BoundaryError(
              "TAMPERED_INPUT",
              "Server apply requires a nonce.",
            );
          }
          if (get().lastNonce === nonce) {
            throw new BoundaryError(
              "REPLAY",
              "Preference payload nonce was already applied.",
            );
          }
          const parsed = parseServerPayload(
            payload,
            sanitizePreferenceFields,
            "notification-preferences",
          );
          const session = getSession();
          assertSessionConnected(session);
          assertOwnerMatches(session, get().ownerKey);
          set({
            ...parsed,
            ownerKey: sessionKey(session),
            lastNonce: nonce,
          });
        },
      }),
      {
        name: "notification-preferences",
        validate: validatePrefsPartial,
      },
    ),
    {
      name: "notification-preferences",
      version: 1,
      migrate: migratePreferenceState,
      storage: createJSONStorage(() => safePreferenceStorage),
      partialize: (state) => ({
        email: state.email,
        push: state.push,
        frequency: state.frequency,
        quietHours: state.quietHours,
        vaultOverrides: state.vaultOverrides,
        ownerKey: state.ownerKey,
        lastNonce: state.lastNonce,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object") return current;
        const rec = persisted as Record<string, unknown>;
        const fields = sanitizePreferenceFields(rec);
        if (!fields) return current;

        const persistedOwner =
          typeof rec.ownerKey === "string" ? rec.ownerKey : null;
        const session = getSession();
        if (session.address) {
          const live = sessionKey(session);
          if (persistedOwner && persistedOwner !== live) {
            return current;
          }
        }

        return {
          ...current,
          ...fields,
          ownerKey: persistedOwner ?? current.ownerKey,
          lastNonce:
            typeof rec.lastNonce === "string"
              ? rec.lastNonce
              : current.lastNonce,
        };
      },
    },
  ),
);
