import { useEffect, useRef } from 'react';
import { useConnectivityStore, type ConnectivityStatus } from '../services/connectivity';
import { isApiEnabled } from '../services/api';

/**
 * Executes a callback when connectivity recovers back to 'online' from a degraded state ('offline' or 'api-down').
 * Skips in offline-fixture mode (when VITE_API is unset).
 */
export function useOnRecovered(callback: () => void) {
  const status = useConnectivityStore((state) => state.status);
  const prevStatusRef = useRef<ConnectivityStatus>(status);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!isApiEnabled()) return;

    const prev = prevStatusRef.current;
    if ((prev === 'offline' || prev === 'api-down' || prev === 'checking') && status === 'online') {
      callbackRef.current();
    }

    prevStatusRef.current = status;
  }, [status]);
}
