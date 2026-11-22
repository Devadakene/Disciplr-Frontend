import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import {
  WalletProvider,
  useWallet,
  DEMO_ADDRESS,
  DEMO_MODE_KEY,
  WALLET_DISCONNECTED_KEY,
  WALLET_WATCH_INTERVAL,
} from '../WalletContext';
import * as freighterApi from '@stellar/freighter-api';

vi.mock('@stellar/freighter-api', () => ({
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn().mockResolvedValue({ network: 'PUBLIC' }),
  WatchWalletChanges: class {
    timeout?: number;
    watch = vi.fn();
    stop = vi.fn();
    constructor(timeout?: number) {
      this.timeout = timeout;
    }
  },
}));

vi.mock('../../utils/horizon', () => ({
  fetchUsdcBalance: vi.fn().mockResolvedValue({ balance: '1.00', hasTrustline: true }),
}));

vi.mock('../../utils/walletTelemetry', () => ({
  recordWalletTelemetry: vi.fn(),
  classifyConnectError: vi.fn().mockReturnValue('unknown_error'),
}));

function TestConsumer() {
  const { address, sessionStatus, status, network, balance, balanceStatus, connectDemo, disconnect } =
    useWallet();
  return (
    <div>
      <div data-testid="session-status">{sessionStatus}</div>
      <div data-testid="status">{status}</div>
      <div data-testid="address">{address ?? 'none'}</div>
      <div data-testid="network">{network ?? 'none'}</div>
      <div data-testid="balance">{balance ?? 'none'}</div>
      <div data-testid="balance-status">{balanceStatus}</div>
      <button onClick={connectDemo}>demo</button>
      <button onClick={disconnect}>disconnect</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <WalletProvider>
      <TestConsumer />
    </WalletProvider>,
  );

const expectDemoState = () => {
  expect(screen.getByTestId('status').textContent).toBe('connected');
  expect(screen.getByTestId('session-status').textContent).toBe('authenticated');
  expect(screen.getByTestId('address').textContent).toBe(DEMO_ADDRESS);
  expect(screen.getByTestId('network').textContent).toBe('TESTNET');
  expect(screen.getByTestId('balance').textContent).toBe('10000.0000000');
  expect(screen.getByTestId('balance-status').textContent).toBe('success');
};

describe('WalletContext demo mode persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    // A real Freighter session exists; it must not override the demo session.
    vi.mocked(freighterApi.isAllowed).mockResolvedValue({ isAllowed: true });
    vi.mocked(freighterApi.getAddress).mockResolvedValue({ address: 'GREALFREIGHTERACCOUNT' });
  });

  it('restores the demo session after a reload without consulting Freighter', async () => {
    const first = renderProvider();
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText('demo'));
    expectDemoState();
    expect(localStorage.getItem(DEMO_MODE_KEY)).toBe('true');

    // Simulate a full page reload: unmount and mount a fresh provider.
    first.unmount();
    vi.clearAllMocks();
    renderProvider();

    // Connected synchronously on first render, no "restoring" flash.
    expectDemoState();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expectDemoState();
    expect(freighterApi.isAllowed).not.toHaveBeenCalled();
    expect(freighterApi.getAddress).not.toHaveBeenCalled();
  });

  it('does not poll Freighter for account changes while demo mode is active', async () => {
    vi.useFakeTimers();
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    renderProvider();

    await act(async () => {
      vi.advanceTimersByTime(WALLET_WATCH_INTERVAL * 3);
    });

    expectDemoState();
    expect(freighterApi.getAddress).not.toHaveBeenCalled();
  });

  it('clears the persisted demo flag on disconnect so a reload stays disconnected', async () => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    const first = renderProvider();
    expectDemoState();

    fireEvent.click(screen.getByText('disconnect'));
    expect(localStorage.getItem(DEMO_MODE_KEY)).toBeNull();
    expect(localStorage.getItem(WALLET_DISCONNECTED_KEY)).toBe('true');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('address').textContent).toBe('none');

    first.unmount();
    renderProvider();
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('address').textContent).toBe('none');
  });
});
