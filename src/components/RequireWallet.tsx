import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWallet } from '../context/WalletContext';
import { WalletConnectButton } from './Wallet/WalletConnectButton';
import Skeleton from './Skeleton';

interface RequireWalletProps {
  children: ReactNode;
}

/**
 * Invariants:
 * - Authorization is granted iff a non-empty wallet address is present and sessionStatus is authenticated.
 * - While sessionStatus is 'resolving', a deterministic skeleton is rendered with aria-busy="true" and
 *   visually hidden "Checking wallet…". Children are never mounted during resolution to prevent leaking
 *   protected content or initiating wallet-scoped data fetches.
 * - A hard cap (5s) prevents hung authorization checks from indefinitely displaying the skeleton.
 * - When unauthorized ('anonymous' or resolution timed out without an address), the connect prompt is shown.
 * - When authorized, children are rendered in place without redundant or stale navigations.
 */
export default function RequireWallet({ children }: RequireWalletProps) {
  const { address, isConnecting, connectDemo, sessionStatus } = useWallet();
  const [timedOut, setTimedOut] = useState(false);

  // Normalize the address so whitespace-only or empty strings are treated as unauthorized.
  const normalizedAddress = useMemo(() => {
    if (typeof address !== 'string') return null;
    const trimmed = address.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [address]);

  // Hard cap on resolving (5 seconds)
  useEffect(() => {
    if (sessionStatus !== 'resolving') {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [sessionStatus]);

  const isResolving = sessionStatus === 'resolving' && !timedOut;

  if (isResolving) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" data-testid="require-wallet-resolving">
        <span
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Checking wallet…
        </span>
        <Skeleton className="w-full h-screen" ariaLabel="Checking wallet…" />
      </div>
    );
  }

  if (normalizedAddress && sessionStatus === 'authenticated') {
    return <>{children}</>;
  }

  return (
    <div
      role="main"
      aria-labelledby="connect-wallet-heading"
      style={{ textAlign: 'center', padding: '4rem 1rem' }}
    >
      <h1 id="connect-wallet-heading">Connect your wallet</h1>
      <p>You need a connected wallet to access this page.</p>
      {isConnecting && <p aria-live="polite">Connecting…</p>}
      <WalletConnectButton />
      <p style={{ marginTop: '1rem' }}>
        No Freighter wallet?{' '}
        <button type="button" onClick={connectDemo} style={{ background: 'none', border: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
          Try the demo account
        </button>
      </p>
    </div>
  );
}
