import { useState } from 'react';
import { useConnectivityStore } from '../services/connectivity';
import { isApiEnabled } from '../services/api';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { formatRelativeTime } from '../utils/relativeTime';

export function ConnectivityBanner() {
  const status = useConnectivityStore((state) => state.status);
  const retryNow = useConnectivityStore((state) => state.retryNow);
  const degradedSince = useConnectivityStore((state) => state.degradedSince);
  const [retrying, setRetrying] = useState(false);

  // Refresh every 30 s so the relative timestamp stays current.
  const now = useCurrentTime(30_000);

  // Skip completely in offline-fixture mode (when VITE_API is unset)
  if (!isApiEnabled() || status === 'online') {
    return null;
  }

  const isOffline = status === 'offline';
  const message = isOffline
    ? "You're offline. Check your internet connection."
    : 'Disciplr service is unavailable, retrying…';

  const sinceText =
    !isOffline && degradedSince != null
      ? ` · since ${formatRelativeTime(degradedSince, now)}`
      : '';

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryNow();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: isOffline ? 'var(--danger, #ef4444)' : 'var(--warning, #f59e0b)',
        color: '#fff',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        fontWeight: 500,
        fontSize: '0.9rem',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span aria-hidden="true">{isOffline ? '📡' : '⚠️'}</span>
        <span>
          {message}
          {sinceText}
        </span>
      </div>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          borderRadius: 'var(--radius, 6px)',
          color: '#fff',
          padding: '0.35rem 0.75rem',
          cursor: retrying ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem',
          transition: 'background 0.2s',
        }}
      >
        {retrying ? 'Retrying…' : 'Retry now'}
      </button>
    </div>
  );
}
