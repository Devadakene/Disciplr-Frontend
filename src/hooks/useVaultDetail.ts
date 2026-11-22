/**
 * useVaultDetail.ts
 *
 * Loads and validates a single vault through the Promise-based service seam.
 * Every value that crosses the trust boundary (the route id and the server
 * response) is validated here before the page renders vault state or offers
 * sensitive actions.
 *
 * Statuses:
 * - loading: fetch in flight
 * - invalid-id: the route parameter is not a usable vault id (hostile input)
 * - not-found: no vault exists for a well-formed id
 * - malformed: the fetched response failed structural validation — the UI
 *   refuses to render unverified vault data
 * - error: the service rejected while fetching
 * - ready: a fully validated vault
 */

import { useCallback, useEffect, useState } from "react";
import { getVault } from "../services/vaultService";
import {
  isValidVaultRouteId,
  validateVaultResponse,
} from "../utils/vaultState";
import type { Vault } from "../types/vault";

export type VaultDetailView =
  | { status: "loading" }
  | { status: "invalid-id"; id: string }
  | { status: "not-found"; id: string }
  | { status: "malformed"; id: string; issues: string[] }
  | { status: "error"; id: string }
  | { status: "ready"; id: string; vault: Vault };

export interface UseVaultDetailResult {
  view: VaultDetailView;
  retry: () => void;
}

export function useVaultDetail(id: string | undefined): UseVaultDetailResult {
  const [retryCount, setRetryCount] = useState(0);
  const [view, setView] = useState<VaultDetailView>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setView({ status: "loading" });

    if (!isValidVaultRouteId(id)) {
      setView({ status: "invalid-id", id: id ?? "" });
      return;
    }

    getVault(id)
      .then((raw) => {
        if (cancelled) return;
        if (raw === undefined) {
          setView({ status: "not-found", id });
          return;
        }
        const result = validateVaultResponse(raw);
        if (!result.ok) {
          setView({ status: "malformed", id, issues: result.issues });
          return;
        }
        setView({ status: "ready", id, vault: result.vault });
      })
      .catch(() => {
        if (!cancelled) setView({ status: "error", id });
      });

    return () => {
      cancelled = true;
    };
  }, [id, retryCount]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);

  return { view, retry };
}