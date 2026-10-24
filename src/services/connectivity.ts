import { create } from 'zustand';
import { getRawApiBase, isApiEnabled } from './api';

export type ConnectivityStatus = 'online' | 'offline' | 'api-down' | 'checking';

export interface ConnectivityState {
  status: ConnectivityStatus;
  lastHealthyAt: number | null;
  probeInProgress: boolean;
  setStatus: (status: ConnectivityStatus) => void;
  reportApiFailure: (status: number) => void;
  probeHealth: () => Promise<boolean>;
  retryNow: () => Promise<boolean>;
  reset: () => void;
}

let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let currentDelayMs = 2000;
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

export const resetBackoffSchedule = () => {
  currentDelayMs = INITIAL_BACKOFF_MS;
  if (backoffTimer) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
};

export const getBackoffDelay = () => currentDelayMs;

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  status: 'online',
  lastHealthyAt: null,
  probeInProgress: false,

  setStatus: (status: ConnectivityStatus) => set({ status }),

  reset: () => {
    resetBackoffSchedule();
    set({
      status: 'online',
      lastHealthyAt: null,
      probeInProgress: false,
    });
  },

  reportApiFailure: (httpStatus: number) => {
    if (!isApiEnabled()) return;

    if (httpStatus === 0 || httpStatus >= 500) {
      const state = get();
      if (state.status === 'offline') return;

      if (state.status !== 'api-down') {
        set({ status: 'api-down' });
      }

      startBackoffLoop();
    }
  },

  probeHealth: async () => {
    if (!isApiEnabled()) {
      set({ status: 'online' });
      return true;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ status: 'offline' });
      return false;
    }

    const state = get();
    if (state.probeInProgress) {
      return state.status === 'online';
    }

    set({ probeInProgress: true });

    try {
      const res = await fetch(`${getRawApiBase()}/health`, {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
      });

      if (res.ok) {
        const now = Date.now();
        resetBackoffSchedule();
        set({
          status: 'online',
          lastHealthyAt: now,
          probeInProgress: false,
        });
        return true;
      } else {
        set({
          status: 'api-down',
          probeInProgress: false,
        });
        return false;
      }
    } catch {
      set({
        status: 'api-down',
        probeInProgress: false,
      });
      return false;
    }
  },

  retryNow: async () => {
    resetBackoffSchedule();
    return await get().probeHealth();
  },
}));

function startBackoffLoop() {
  if (backoffTimer) return;

  const scheduleNext = () => {
    backoffTimer = setTimeout(async () => {
      backoffTimer = null;

      // Stop probing when document is hidden; visibilitychange will resume
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      // If browser is offline, don't probe /health; browser online event will re-check
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        useConnectivityStore.getState().setStatus('offline');
        return;
      }

      const isHealthy = await useConnectivityStore.getState().probeHealth();
      if (!isHealthy) {
        currentDelayMs = Math.min(currentDelayMs * 2, MAX_BACKOFF_MS);
        scheduleNext();
      }
    }, currentDelayMs);
  };

  scheduleNext();
}

let listenersInitialized = false;

export function initConnectivityListeners() {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  window.addEventListener('online', () => {
    if (!isApiEnabled()) {
      useConnectivityStore.getState().setStatus('online');
      return;
    }
    // When coming online, probe health to confirm whether the API is reachable
    useConnectivityStore.getState().probeHealth();
  });

  window.addEventListener('offline', () => {
    resetBackoffSchedule();
    useConnectivityStore.getState().setStatus('offline');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const state = useConnectivityStore.getState();
      if (state.status === 'api-down' && !backoffTimer) {
        startBackoffLoop();
      }
    }
  });

  // Initial check if browser is already offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    useConnectivityStore.getState().setStatus('offline');
  }
}
