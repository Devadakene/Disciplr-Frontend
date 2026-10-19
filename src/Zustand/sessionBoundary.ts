import { isValidStellarAddress } from "../utils/stellarAddress";
import {
  APP_EXPECTED_NETWORK,
  isNetworkMismatch,
} from "../utils/networkMismatch";
import type { WalletNetwork } from "../context/WalletContext";
import { BoundaryError } from "./boundaryErrors";

/**
 * Live authorization snapshot. Stores must read this instead of inferring
 * ownership from persisted client state or leftover UI fields.
 *
 * WalletContext is the only production writer. Tests may call
 * `__setSessionForTests` / `__resetSessionForTests`.
 */
export type SessionSnapshot = {
  address: string | null;
  network: WalletNetwork | null;
  /** Monotonic epoch bumped on every bind/clear so stale work can be dropped. */
  epoch: number;
};

export type BindSessionInput = {
  address: string;
  network: WalletNetwork;
};

const DEFAULT_SNAPSHOT: SessionSnapshot = {
  address: null,
  network: null,
  epoch: 0,
};

let snapshot: SessionSnapshot = { ...DEFAULT_SNAPSHOT };
const listeners = new Set<(next: SessionSnapshot) => void>();

function emit() {
  for (const listener of listeners) listener(snapshot);
}

export function getSession(): SessionSnapshot {
  return snapshot;
}

export function subscribeSession(
  listener: (next: SessionSnapshot) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function bindSession(input: BindSessionInput): SessionSnapshot {
  const address = input.address?.trim?.() ?? "";
  if (!isValidStellarAddress(address)) {
    throw new BoundaryError(
      "INVALID_ADDRESS",
      "Wallet identity is not a valid Stellar address.",
    );
  }
  if (input.network !== "TESTNET" && input.network !== "PUBLIC") {
    throw new BoundaryError("WRONG_NETWORK", "Unknown wallet network.");
  }
  if (isNetworkMismatch(input.network, APP_EXPECTED_NETWORK)) {
    throw new BoundaryError(
      "WRONG_NETWORK",
      `Wallet is on ${input.network}; app expects ${APP_EXPECTED_NETWORK}.`,
    );
  }

  snapshot = {
    address,
    network: input.network,
    epoch: snapshot.epoch + 1,
  };
  emit();
  return snapshot;
}

export function clearSession(): SessionSnapshot {
  snapshot = {
    address: null,
    network: null,
    epoch: snapshot.epoch + 1,
  };
  emit();
  return snapshot;
}

export function assertConnectedSession(): SessionSnapshot {
  if (!snapshot.address || !snapshot.network) {
    throw new BoundaryError(
      "DISCONNECTED_WALLET",
      "A connected wallet is required for this action.",
    );
  }
  if (!isValidStellarAddress(snapshot.address)) {
    throw new BoundaryError(
      "INVALID_ADDRESS",
      "Connected wallet identity failed validation.",
    );
  }
  if (isNetworkMismatch(snapshot.network, APP_EXPECTED_NETWORK)) {
    throw new BoundaryError(
      "WRONG_NETWORK",
      `Wallet is on ${snapshot.network}; app expects ${APP_EXPECTED_NETWORK}.`,
    );
  }
  return snapshot;
}

export function sessionKey(session: SessionSnapshot = snapshot): string {
  if (!session.address || !session.network) return "anonymous";
  return `${session.network}:${session.address}`;
}

/** Test-only. Does not re-validate so adversarial fixtures can be injected. */
export function __setSessionForTests(next: Partial<SessionSnapshot>) {
  snapshot = {
    address: next.address === undefined ? snapshot.address : next.address,
    network: next.network === undefined ? snapshot.network : next.network,
    epoch: next.epoch === undefined ? snapshot.epoch + 1 : next.epoch,
  };
  emit();
}

export function __resetSessionForTests() {
  snapshot = { ...DEFAULT_SNAPSHOT };
  emit();
}
