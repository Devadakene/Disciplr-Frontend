import { Link } from "react-router-dom";
import Breadcrumb from "../Breadcrumb";
import { ConfirmationModal } from "../ConfirmationModal";
import { MilestoneTracker } from "../MilestoneTracker";
import { Text } from "../Text";
import { useWallet, type WalletNetwork } from "../../context/WalletContext";
import { useVaultActions } from "../../hooks/useVaultActions";
import type { Vault } from "../../types/vault";
import { NetworkFooterBanner } from "./NetworkFooterBanner";
import { VaultCard } from "./VaultCard";
import { VaultHeaderCard } from "./VaultHeaderCard";
import { VaultInfoSection } from "./VaultInfoSection";
import { VaultTimelineCard } from "./VaultTimelineCard";
import { VaultTransactionsCard } from "./VaultTransactionsCard";
import "./vaultDetail.css";

export interface VaultDetailContentProps {
  vault: Vault;
  walletAddress: string | null;
  walletNetwork: WalletNetwork | null;
  onChanged?: () => void;
}

export function VaultDetailContent({
  vault,
  walletAddress,
  walletNetwork,
  onChanged,
}: VaultDetailContentProps) {
  const { network, connectDemo } = useWallet();
  const {
    activeAction,
    activeActionConfig,
    isSubmitting,
    isVaultActionPending,
    actionError,
    authResults,
    handleActionClick,
    handleModalClose,
    handleActionConfirm,
  } = useVaultActions(vault, { walletAddress, walletNetwork, onChanged });

  const isActive =
    vault.status === "active" || vault.status === "pending_validation";

  return (
    <div className="vault-detail-container">
      <Breadcrumb
        segments={[
          { label: "Home", to: "/" },
          { label: "Vaults", to: "/vaults" },
          { label: vault.name },
        ]}
        className="vault-detail-breadcrumb"
      />

      <Link to="/vaults" className="vault-detail-back-link">
        ← Back to Vaults
      </Link>

      <VaultHeaderCard
        vault={vault}
        walletAddress={walletAddress}
        isActive={isActive}
        isVaultActionPending={isVaultActionPending}
        authResults={authResults}
        onConnectDemo={connectDemo}
        onActionClick={handleActionClick}
      />

      <VaultTimelineCard vault={vault} isActive={isActive} />

      <VaultInfoSection vault={vault} network={network} />

      <VaultCard className="vault-card--spaced">
        <Text role="caption" as="div" className="vault-section-heading">
          Milestones
        </Text>
        <MilestoneTracker milestones={vault.milestones} />
      </VaultCard>

      <VaultTransactionsCard vault={vault} network={network} />

      <NetworkFooterBanner
        network={network}
        contractAddress={vault.contractAddress}
      />

      {activeAction && activeActionConfig && (
        <>
          {actionError && (
            <div role="alert" className="vault-alert vault-alert--spaced-top">
              {actionError}
            </div>
          )}
          <ConfirmationModal
            isOpen={activeAction !== null}
            onClose={handleModalClose}
            onConfirm={handleActionConfirm}
            simpleConfirm={activeActionConfig}
            isSubmitting={isSubmitting}
          />
        </>
      )}
    </div>
  );
}
