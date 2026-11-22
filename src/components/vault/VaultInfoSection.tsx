import { FundReleaseStatus } from "../FundReleaseStatus";
import { Text } from "../Text";
import { VaultMetaPanel } from "../VaultMetaPanel";
import type { WalletNetwork } from "../../context/WalletContext";
import { formatDateTime, formatUsdc } from "../../utils/format";
import { APP_EXPECTED_NETWORK } from "../../utils/networkMismatch";
import {
  buildFundReleaseView,
  detectSettlementAnomalies,
} from "../../utils/vaultState";
import type { Vault } from "../../types/vault";
import { InfoRow } from "./InfoRow";
import { VaultCard } from "./VaultCard";
import "./vaultDetail.css";

function durationLabel(start: string, end: string): string {
  const days = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000,
  );
  if (days >= 365) return `${Math.round(days / 365)}y`;
  if (days >= 30) return `${Math.round(days / 30)}mo`;
  return `${days}d`;
}

export interface VaultInfoSectionProps {
  vault: Vault;
  network: WalletNetwork | null;
}

export function VaultInfoSection({ vault, network }: VaultInfoSectionProps) {
  const settlement = buildFundReleaseView(vault);
  const settlementAnomalies = detectSettlementAnomalies(vault);

  return (
    <>
      <div className="vault-info-grid">
        <VaultCard>
          <Text role="caption" as="div" className="vault-section-heading">
            Vault Info
          </Text>
          <div className="vault-info-list">
            <InfoRow label="Created" value={formatDateTime(vault.createdAt)} />
            <InfoRow label="Deadline" value={formatDateTime(vault.deadline)} />
            <InfoRow
              label="Duration"
              value={durationLabel(vault.createdAt, vault.deadline)}
            />
            <InfoRow
              label="Amount"
              value={`${formatUsdc(vault.amount)} ${vault.currency}`}
            />
          </div>
        </VaultCard>

        <VaultCard>
          <VaultMetaPanel
            network={network}
            creatorAddress={vault.creatorAddress}
            verifierAddress={vault.verifierAddress}
            successAddress={vault.successAddress}
            failureAddress={vault.failureAddress}
            contractAddress={vault.contractAddress}
          />
        </VaultCard>
      </div>

      {settlementAnomalies.length > 0 && (
        <div
          role="alert"
          aria-label="Fund release inconsistency notice"
          className="vault-alert vault-alert--spaced-bottom"
        >
          <Text role="caption" as="p" className="vault-alert__title">
            Fund release data could not be verified:
          </Text>
          <ul className="vault-alert__list">
            {settlementAnomalies.map((anomaly) => (
              <li key={anomaly}>{anomaly}</li>
            ))}
          </ul>
        </div>
      )}

      <FundReleaseStatus {...settlement} network={APP_EXPECTED_NETWORK} />
    </>
  );
}
