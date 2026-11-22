import { useCallback, useMemo, useState } from "react";
import type { WalletNetwork } from "../context/WalletContext";
import { submitVaultAction } from "../services/vaultService";
import { APP_EXPECTED_NETWORK } from "../utils/networkMismatch";
import {
  VAULT_ACTIONS,
  evalVaultActionAuth,
  isApiMode,
  type VaultAction,
  type VaultActionAuth,
} from "../utils/vaultState";
import type { Vault } from "../types/vault";
import { mapActionError } from "./mapActionError";

export interface VaultActionModalConfig {
  title: string;
  message: string;
  confirmLabel: string;
}

export const VAULT_ACTION_CONFIG: Record<VaultAction, VaultActionModalConfig> =
  {
    validate_milestone: {
      title: "Validate Milestone",
      message:
        "Are you sure you want to validate the current milestone? This will trigger an on-chain transaction to advance the vault. This action cannot be undone.",
      confirmLabel: "Validate",
    },
    extend_deadline: {
      title: "Extend Deadline",
      message:
        "Are you sure you want to extend the vault deadline? The new deadline must be confirmed by all relevant parties before taking effect.",
      confirmLabel: "Extend",
    },
    cancel_vault: {
      title: "Cancel Vault",
      message:
        "Are you sure you want to cancel this vault? Funds will be redirected to the failure destination address. This action cannot be undone.",
      confirmLabel: "Cancel Vault",
    },
  };

export interface UseVaultActionsOptions {
  walletAddress: string | null;
  walletNetwork: WalletNetwork | null;
  onChanged?: () => void;
}

export interface UseVaultActionsResult {
  activeAction: VaultAction | null;
  activeActionConfig: VaultActionModalConfig | null;
  isSubmitting: boolean;
  isVaultActionPending: boolean;
  actionError: string | null;
  authResults: Record<VaultAction, VaultActionAuth>;
  handleActionClick: (action: VaultAction) => void;
  handleModalClose: () => void;
  handleActionConfirm: () => Promise<void>;
}

export function useVaultActions(
  vault: Vault,
  { walletAddress, walletNetwork, onChanged }: UseVaultActionsOptions,
): UseVaultActionsResult {
  const [activeAction, setActiveAction] = useState<VaultAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const authResults = useMemo(() => {
    const results = {} as Record<VaultAction, VaultActionAuth>;
    for (const action of VAULT_ACTIONS) {
      results[action] = evalVaultActionAuth({
        action,
        vault,
        walletAddress,
        walletNetwork,
        expectedNetwork: APP_EXPECTED_NETWORK,
        mode: isApiMode() ? "api" : "offline",
      });
    }
    return results;
  }, [vault, walletAddress, walletNetwork]);

  const handleActionClick = useCallback(
    (action: VaultAction) => {
      if (isSubmitting) return;
      setActiveAction(action);
      setActionError(null);
    },
    [isSubmitting],
  );

  const handleModalClose = useCallback(() => {
    if (isSubmitting) return;
    setActiveAction(null);
    setActionError(null);
  }, [isSubmitting]);

  const handleActionConfirm = useCallback(async () => {
    if (!activeAction || !walletAddress || isSubmitting) return;

    setActionError(null);
    setIsSubmitting(true);
    try {
      await submitVaultAction(activeAction, vault.id, walletAddress);
      setActiveAction(null);
      onChanged?.();
    } catch (err) {
      setActionError(mapActionError(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [activeAction, walletAddress, isSubmitting, vault.id, onChanged]);

  return {
    activeAction,
    activeActionConfig: activeAction ? VAULT_ACTION_CONFIG[activeAction] : null,
    isSubmitting,
    isVaultActionPending: isSubmitting,
    actionError,
    authResults,
    handleActionClick,
    handleModalClose,
    handleActionConfirm,
  };
}
