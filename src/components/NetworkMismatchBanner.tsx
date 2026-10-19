import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useWallet, type WalletNetwork } from '../context/WalletContext';
import { networkLabel } from '../utils/explorer';
import { APP_EXPECTED_NETWORK, isNetworkMismatch } from '../utils/networkMismatch';
import { recordWalletTelemetry } from '../utils/walletTelemetry';

const FREIGHTER_NETWORK_HELP_URL = 'https://docs.freighter.app/';

interface NetworkMismatchBannerProps {
  expectedNetwork?: WalletNetwork;
}

export function NetworkMismatchBanner({
  expectedNetwork = APP_EXPECTED_NETWORK,
}: NetworkMismatchBannerProps) {
  const { address, network } = useWallet();
  const [dismissedMismatch, setDismissedMismatch] = useState<string | null>(null);
  const hasMismatch = Boolean(address) && isNetworkMismatch(network, expectedNetwork);
  const mismatchKey = useMemo(
    () => `${address ?? 'disconnected'}:${network ?? 'unknown'}:${expectedNetwork}`,
    [address, network, expectedNetwork],
  );
  const showBanner = hasMismatch && dismissedMismatch !== mismatchKey;

  useEffect(() => {
    if (!hasMismatch) {
      setDismissedMismatch(null);
    }
  }, [hasMismatch]);

  // Telemetry on visibility transitions only — never re-emitted on unrelated
  // re-renders, so rapid network checks cannot spam the diagnostics buffer.
  const prevShownRef = useRef(false);
  useEffect(() => {
    if (showBanner && !prevShownRef.current) {
      recordWalletTelemetry({
        event: 'wallet.network.mismatch_shown',
        ts: Date.now(),
        network: network ?? 'unknown',
        expectedNetwork,
      });
    }
    prevShownRef.current = showBanner;
  }, [showBanner, network, expectedNetwork]);

  const prevMismatchRef = useRef(hasMismatch);
  useEffect(() => {
    if (!hasMismatch && prevMismatchRef.current) {
      recordWalletTelemetry({
        event: 'wallet.network.recovered',
        ts: Date.now(),
        network: network ?? 'unknown',
        expectedNetwork,
      });
    }
    prevMismatchRef.current = hasMismatch;
  }, [hasMismatch, network, expectedNetwork]);

  if (!showBanner) {
    return null;
  }

  return (
    <div
      role="alert"
      style={{
        background: 'var(--danger-transparent)',
        border: 'var(--border-width-1) solid var(--danger)',
        color: 'var(--text)',
        padding: 'var(--spacing-3) var(--spacing-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--spacing-4)',
        flexWrap: 'wrap',
      }}
    >
      <span>
        <strong>Wrong wallet network.</strong> Freighter is on{' '}
        <strong>{networkLabel(network)}</strong>, but Disciplr expects{' '}
        <strong>{networkLabel(expectedNetwork)}</strong>. Switch Freighter before
        creating or validating vaults.
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
        <a
          href={FREIGHTER_NETWORK_HELP_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Switch Freighter network"
          style={{
            color: 'var(--danger)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-1)',
            fontWeight: 700,
          }}
        >
          Switch network
          <ExternalLink size={14} aria-hidden="true" />
        </a>
        <button
          type="button"
          aria-label="Dismiss network mismatch warning"
          onClick={() => {
            setDismissedMismatch(mismatchKey);
            recordWalletTelemetry({
              event: 'wallet.network.dismissed',
              ts: Date.now(),
              network: network ?? 'unknown',
              expectedNetwork,
            });
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--danger)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'var(--touch-target)',
            minWidth: 'var(--touch-target)',
            padding: 0,
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
