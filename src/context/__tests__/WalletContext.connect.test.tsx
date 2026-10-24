import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletProvider, useWallet } from '../WalletContext';

const freighterApi = vi.hoisted(() => ({
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
  WatchWalletChanges: class {
    watch = vi.fn();
    stop = vi.fn();
  },
}));

const telemetry = vi.hoisted(() => ({
  recordWalletTelemetry: vi.fn(),
  classifyConnectError: vi.fn((message?: string | null) => {
    if (!message) return 'unknown';
    const normalized = message.toLowerCase();
    if (normalized.includes('access denied')) return 'access_denied';
    if (normalized.includes('address unavailable') || normalized.includes('failed to get wallet address')) return 'address_unavailable';
    if (normalized.includes('timed out') || normalized.includes('timeout')) return 'timeout';
    if (normalized.includes('cancel')) return 'cancelled';
    return 'wallet_error';
  }),
}));

vi.mock('@stellar/freighter-api', () => freighterApi);
vi.mock('../../utils/walletTelemetry', () => ({
  recordWalletTelemetry: telemetry.recordWalletTelemetry,
  classifyConnectError: telemetry.classifyConnectError,
  resolveConnectTimeoutMs: vi.fn(() => 30_000),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('WalletContext connect flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    freighterApi.isAllowed.mockResolvedValue({ isAllowed: false });
    freighterApi.setAllowed.mockResolvedValue(undefined);
    freighterApi.requestAccess.mockResolvedValue(true);
    freighterApi.getAddress.mockResolvedValue({ address: 'GTEST', error: null });
    freighterApi.getNetworkDetails.mockResolvedValue({ network: 'TESTNET' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('times out a hanging request and permits a later retry', async () => {
    const firstAccess = deferred<boolean>();
    freighterApi.requestAccess.mockReturnValue(firstAccess.promise);
    const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
    const { result } = renderHook(() => useWallet(), { wrapper });

    const first = result.current.connect();
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    await expect(first).resolves.toBe(false);
    expect(result.current.error).toContain("Freighter didn't respond");

    freighterApi.requestAccess.mockResolvedValue(true);
    freighterApi.getAddress.mockResolvedValue({ address: 'GNEW', error: null });
    freighterApi.getNetworkDetails.mockResolvedValue({ network: 'TESTNET' });

    await act(async () => {
      const second = result.current.connect();
      await expect(second).resolves.toBe(true);
    });

    expect(result.current.address).toBe('GNEW');
    expect(telemetry.recordWalletTelemetry.mock.calls.filter(([event]) => event.event === 'wallet.connect.attempt')).toHaveLength(2);
  });

  it('ignores a late resolution from a timed-out attempt', async () => {
    const access = deferred<boolean>();
    freighterApi.requestAccess.mockReturnValue(access.promise);
    const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
    const { result } = renderHook(() => useWallet(), { wrapper });

    const first = result.current.connect();
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    await expect(first).resolves.toBe(false);

    access.resolve(true);
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.address).toBeNull();
  });

  it('emits a single access_denied failure', async () => {
    freighterApi.requestAccess.mockResolvedValue(false);
    const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    const failures = telemetry.recordWalletTelemetry.mock.calls.filter(([event]) => event.event === 'wallet.connect.failure');
    expect(failures).toHaveLength(1);
    expect(failures[0][0]).toMatchObject({ errorCode: 'access_denied' });
  });

  it('emits a single address_unavailable failure', async () => {
    freighterApi.requestAccess.mockResolvedValue(true);
    freighterApi.getAddress.mockResolvedValue({ address: null, error: 'Failed to get wallet address.' });
    const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    const failures = telemetry.recordWalletTelemetry.mock.calls.filter(([event]) => event.event === 'wallet.connect.failure');
    expect(failures).toHaveLength(1);
    expect(failures[0][0]).toMatchObject({ errorCode: 'address_unavailable' });
    expect(telemetry.classifyConnectError).toHaveBeenCalledWith('Failed to get wallet address.');
  });

  it('emits a single classified failure without raw error text', async () => {
    freighterApi.requestAccess.mockResolvedValue(true);
    freighterApi.getAddress.mockRejectedValue(new Error('Freighter is locked.'));
    const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    const failures = telemetry.recordWalletTelemetry.mock.calls.filter(([event]) => event.event === 'wallet.connect.failure');
    expect(failures).toHaveLength(1);
    expect(failures[0][0]).toMatchObject({ errorCode: 'wallet_error' });
    expect(JSON.stringify(telemetry.recordWalletTelemetry.mock.calls)).not.toContain('Freighter is locked.');
  });

  it('allows immediate retry after cancellation', async () => {
    const firstAccess = deferred<boolean>();
    freighterApi.requestAccess.mockReturnValue(firstAccess.promise);
    const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
    const { result } = renderHook(() => useWallet(), { wrapper });

    const first = result.current.connect();
    await act(async () => {
      result.current.cancelConnect();
      await Promise.resolve();
    });

    expect(result.current.error).toContain('cancelled');

    freighterApi.requestAccess.mockResolvedValue(true);
    freighterApi.getAddress.mockResolvedValue({ address: 'GNEW', error: null });
    freighterApi.getNetworkDetails.mockResolvedValue({ network: 'TESTNET' });

    await act(async () => {
      const second = result.current.connect();
      await expect(second).resolves.toBe(true);
    });

    await expect(first).resolves.toBe(false);
  });

  it('shares one promise for concurrent calls during the same pending attempt', async () => {
    const access = deferred<boolean>();
    freighterApi.requestAccess.mockReturnValue(access.promise);
    const wrapper = ({ children }: { children: React.ReactNode }) => <WalletProvider>{children}</WalletProvider>;
    const { result } = renderHook(() => useWallet(), { wrapper });

    const first = result.current.connect();
    const second = result.current.connect();

    expect(first).toBe(second);
    access.resolve(true);
    freighterApi.getAddress.mockResolvedValue({ address: 'GTEST', error: null });
    freighterApi.getNetworkDetails.mockResolvedValue({ network: 'TESTNET' });

    await act(async () => {
      await Promise.resolve();
    });
    expect(telemetry.recordWalletTelemetry.mock.calls.filter(([event]) => event.event === 'wallet.connect.attempt')).toHaveLength(1);
  });
});
