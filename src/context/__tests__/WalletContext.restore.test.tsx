import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { WalletProvider, useWallet, WALLET_DISCONNECTED_KEY } from '../WalletContext';
import * as freighterApi from '@stellar/freighter-api';

vi.mock('@stellar/freighter-api', () => ({
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn().mockResolvedValue({ network: 'TESTNET' }),
}));

vi.mock('../../utils/horizon', () => ({
  fetchUsdcBalance: vi.fn().mockResolvedValue({ balance: '100.00', hasTrustline: true }),
}));

vi.mock('../../utils/walletTelemetry', () => ({
  recordWalletTelemetry: vi.fn(),
  classifyConnectError: vi.fn().mockReturnValue('unknown_error'),
}));

function TestConsumer() {
  const { address, sessionStatus, status, error } = useWallet();
  return (
    <div>
      <div data-testid="session-status">{sessionStatus}</div>
      <div data-testid="status">{status}</div>
      <div data-testid="address">{address ?? 'none'}</div>
      <div data-testid="error">{error ?? 'none'}</div>
    </div>
  );
}

describe('WalletContext session restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions to authenticated when allowed and valid address returned', async () => {
    vi.mocked(freighterApi.isAllowed).mockResolvedValue({ isAllowed: true });
    vi.mocked(freighterApi.getAddress).mockResolvedValue({ address: 'GALLOWED123' });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    // Initial state before promise resolution is resolving / restoring
    expect(screen.getByTestId('session-status').textContent).toBe('resolving');
    expect(screen.getByTestId('status').textContent).toBe('restoring');

    // Wait for resolution
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('session-status').textContent).toBe('authenticated');
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('address').textContent).toBe('GALLOWED123');
  });

  it('transitions to anonymous when isAllowed is false', async () => {
    vi.mocked(freighterApi.isAllowed).mockResolvedValue({ isAllowed: false });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    expect(screen.getByTestId('session-status').textContent).toBe('resolving');

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('session-status').textContent).toBe('anonymous');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('address').textContent).toBe('none');
  });

  it('short-circuits to anonymous immediately when user-disconnected flag is present', async () => {
    localStorage.setItem(WALLET_DISCONNECTED_KEY, 'true');
    vi.mocked(freighterApi.isAllowed).mockResolvedValue({ isAllowed: true });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    // Immediately anonymous without waiting or showing resolving
    expect(screen.getByTestId('session-status').textContent).toBe('anonymous');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(freighterApi.isAllowed).not.toHaveBeenCalled();
  });

  it('transitions to anonymous when getAddress returns an error or empty address', async () => {
    vi.mocked(freighterApi.isAllowed).mockResolvedValue({ isAllowed: true });
    vi.mocked(freighterApi.getAddress).mockResolvedValue({ address: '', error: 'User locked wallet' });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('session-status').textContent).toBe('anonymous');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('address').textContent).toBe('none');
  });

  it('transitions to anonymous when isAllowed throws an error', async () => {
    vi.mocked(freighterApi.isAllowed).mockRejectedValue(new Error('Freighter extension crashed'));

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('session-status').textContent).toBe('anonymous');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('address').textContent).toBe('none');
  });

  it('stays in resolving while isAllowed hangs until resolved or aborted', async () => {
    vi.useFakeTimers();

    // Hang promise
    let resolveAllowed: (val: { isAllowed: boolean }) => void;
    const hangPromise = new Promise<{ isAllowed: boolean }>((resolve) => {
      resolveAllowed = resolve;
    });
    vi.mocked(freighterApi.isAllowed).mockReturnValue(hangPromise);

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>
    );

    expect(screen.getByTestId('session-status').textContent).toBe('resolving');

    // Advance fake timers by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('session-status').textContent).toBe('resolving');

    // Now resolve
    await act(async () => {
      resolveAllowed!({ isAllowed: false });
    });

    expect(screen.getByTestId('session-status').textContent).toBe('anonymous');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
  });
});
