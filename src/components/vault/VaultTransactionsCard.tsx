import { Link } from "react-router-dom";
import { Text } from "../Text";
import type { WalletNetwork } from "../../context/WalletContext";
import { getExplorerTxUrl } from "../../utils/explorer";
import { formatDateTime, formatUsdc } from "../../utils/format";
import { truncateMiddle } from "../../utils/truncate";
import type { Vault } from "../../types/vault";
import { VaultCard } from "./VaultCard";
import "./vaultDetail.css";

const TX_LABELS: Record<string, string> = {
  create: "Vault Created",
  validate: "Milestone Validated",
  release: "Funds Released",
  redirect: "Funds Redirected",
};

export interface VaultTransactionsCardProps {
  vault: Vault;
  network: WalletNetwork | null;
}

export function VaultTransactionsCard({
  vault,
  network,
}: VaultTransactionsCardProps) {
  return (
    <VaultCard>
      <div className="vault-tx-header">
        <Text role="caption" as="div" className="vault-tx-header__title">
          Transaction History
        </Text>
        <Link
          to={`/vaults/${vault.id}/transactions`}
          className="vault-tx-header__view-all"
        >
          View all
        </Link>
      </div>
      <div className="vault-tx-list">
        {vault.transactions.map((tx) => (
          <div key={tx.id} className="vault-tx-row">
            <div>
              <Text role="caption" as="div" className="vault-tx-row__type">
                {TX_LABELS[tx.type]}
              </Text>
              <Text role="caption" as="div" className="vault-tx-row__muted">
                {formatDateTime(tx.timestamp)}
              </Text>
            </div>
            <div className="vault-tx-row__right">
              {tx.amount != null && (
                <Text role="caption" as="span" className="vault-tx-row__amount">
                  {formatUsdc(tx.amount)} {vault.currency}
                </Text>
              )}
              <div className="vault-tx-row__hash-group">
                <Text role="mono" as="span" className="vault-tx-row__hash">
                  {truncateMiddle(tx.hash, 8, 6)}
                </Text>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tx.hash).catch(() => {});
                  }}
                  title="Copy hash"
                  className="vault-tx-row__copy-btn"
                >
                  ⎘
                </button>
                <a
                  href={getExplorerTxUrl(tx.hash, network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vault-tx-row__explorer-link"
                >
                  ↗
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </VaultCard>
  );
}
