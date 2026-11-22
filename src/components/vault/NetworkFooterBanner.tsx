import { Text } from "../Text";
import { contractExplorerUrl, networkLabel } from "../../utils/explorer";
import "./vaultDetail.css";

export interface NetworkFooterBannerProps {
  network: string | null | undefined;
  contractAddress: string;
}

export function NetworkFooterBanner({
  network,
  contractAddress,
}: NetworkFooterBannerProps) {
  const label = networkLabel(network);
  const explorerUrl = contractAddress
    ? contractExplorerUrl(contractAddress, network ?? "TESTNET")
    : "";

  const isTestnet = network !== "PUBLIC";
  const bannerClass = isTestnet
    ? "vault-network-banner vault-network-banner--testnet"
    : "vault-network-banner vault-network-banner--mainnet";

  return (
    <footer aria-label="Network information" className={bannerClass}>
      <span
        aria-label={`Network: ${label}`}
        className="vault-network-banner__badge"
      >
        <span aria-hidden="true" className="vault-network-banner__dot" />
        {label}
      </span>

      {contractAddress && (
        <Text
          role="mono"
          as="span"
          className="vault-network-banner__address"
          aria-label={`Contract address: ${contractAddress}`}
        >
          {contractAddress}
        </Text>
      )}

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View contract ${contractAddress} on Stellar ${label} explorer`}
          className="vault-network-banner__link"
        >
          View on Explorer ↗
        </a>
      )}
    </footer>
  );
}
