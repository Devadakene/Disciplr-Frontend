import { Link } from "react-router-dom";
import { StatusChip } from "../StatusChip";
import { Text } from "../Text";
import { WalletConnectButton } from "../Wallet/WalletConnectButton";
import { formatUsdc } from "../../utils/format";
import { createVaultPrefillFromVault } from "../../utils/vaultPrefill";
import {
  isApiMode,
  type VaultAction,
  type VaultActionAuth,
} from "../../utils/vaultState";
import type { Vault } from "../../types/vault";
import { ActionButton } from "./ActionButton";
import { VaultCard } from "./VaultCard";
import "./vaultDetail.css";

export interface VaultHeaderCardProps {
  vault: Vault;
  walletAddress: string | null;
  isActive: boolean;
  isVaultActionPending: boolean;
  authResults: Record<VaultAction, VaultActionAuth>;
  onConnectDemo: () => void;
  onActionClick: (action: VaultAction) => void;
}

export function VaultHeaderCard({
  vault,
  walletAddress,
  isActive,
  isVaultActionPending,
  authResults,
  onConnectDemo,
  onActionClick,
}: VaultHeaderCardProps) {
  return (
    <VaultCard className="vault-card--spaced">
      <div className="vault-header">
        <div>
          <div className="vault-header__title-row">
            <Text role="title" as="h1" className="vault-header__title">
              {vault.name}
            </Text>
            <StatusChip status={vault.status} size="lg" />
          </div>
          <Text role="display" as="div" className="vault-header__amount">
            {formatUsdc(vault.amount)}{" "}
            <span className="vault-header__currency">{vault.currency}</span>
          </Text>
        </div>

        {!walletAddress ? (
          <div data-testid="vault-connect-cta" className="vault-connect-cta">
            <Text role="caption" as="div" className="vault-connect-cta__hint">
              Connect a wallet to take action
            </Text>
            <div className="vault-connect-cta__actions">
              <WalletConnectButton />
              <button
                type="button"
                onClick={onConnectDemo}
                className="vault-connect-cta__demo-btn"
              >
                Try the demo account
              </button>
            </div>
          </div>
        ) : (
          <div className="vault-header__actions">
            <Link
              to="/vaults/create"
              state={createVaultPrefillFromVault(vault)}
              className="vault-btn vault-btn--link"
            >
              Duplicate Vault
            </Link>
            {isActive && (
              <>
                {(vault.status === "pending_validation" ||
                  vault.status === "active") && (
                  <ActionButton
                    label="Validate Milestone"
                    color="var(--accent)"
                    auth={authResults.validate_milestone}
                    disabled={isVaultActionPending}
                    onClick={() => onActionClick("validate_milestone")}
                  />
                )}
                {!isApiMode() && (
                  <ActionButton
                    label="Extend Deadline"
                    color="var(--warning)"
                    auth={authResults.extend_deadline}
                    disabled={isVaultActionPending}
                    onClick={() => onActionClick("extend_deadline")}
                  />
                )}
                <ActionButton
                  label="Cancel Vault"
                  color="var(--danger)"
                  auth={authResults.cancel_vault}
                  disabled={isVaultActionPending}
                  onClick={() => onActionClick("cancel_vault")}
                />
              </>
            )}
          </div>
        )}
      </div>

      {walletAddress &&
        isActive &&
        !authResults.extend_deadline.allowed &&
        authResults.extend_deadline.reasons.length > 0 && (
          <Text role="caption" as="p" className="vault-header__notice">
            Actions are limited because: {authResults.extend_deadline.reasons[0]}
          </Text>
        )}
      {walletAddress && isActive && isApiMode() && (
        <Text role="caption" as="p" className="vault-header__notice">
          Extending a deadline is not supported by the demo API.
        </Text>
      )}
    </VaultCard>
  );
}
