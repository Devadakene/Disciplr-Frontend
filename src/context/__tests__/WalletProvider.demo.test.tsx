import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import {
  WalletProvider,
  useWallet,
  DEMO_ADDRESS,
  DEMO_MODE_KEY,
  WALLET_DISCONNECTED_KEY,
  ACCOUNT_POLL_INTERVAL,
} from '../WalletContext';
import * as freighterApi from '@stellar/freighter-api';
import { isDemoModeActive } from '../../services/vaultService';
import { getDemoStore } from '../../services/demoStore';

vi.mock('@stellar/freighter-api', () => ({
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn().mockResolvedValue({ network: 'PUBLIC' }),
  WatchWalletChanges: class {
    watch = vi.fn();
    stop = vi.fn();
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
  const {
    address,
    sessionStatus,
    status,
    network,
    balance,
    balanceStatus,
    isDemo,
    connectDemo,
    disconnect,
    resetDemo,
  } = useWallet();
  return (
    <div>
      <div data-testid="session-status">{sessionStatus}</div>
      <div data-testid="status">{status}</div>
      <div data-testid="address">{address ?? 'none'}</div>
      <div data-testid="network">{network ?? 'none'}</div>
      <div data-testid="balance">{balance ?? 'none'}</div>
      <div data-testid="balance-status">{balanceStatus}</div>
      <div data-testid="is-demo">{String(isDemo)}</div>
      <button onClick={connectDemo}>demo</button>
      <button onClick={disconnect}>disconnect</button>
      <button onClick={resetDemo}>resetDemo</button>
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
  expect(screen.getByTestId('is-demo').textContent).toBe('true');
  expect(isDemoModeActive()).toBe(true);
};

describe('WalletProvider demo mode tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(freighterApi.isAllowed).mockResolvedValue({ isAllowed: true });
    vi.mocked(freighterApi.getAddress).mockResolvedValue({ address: 'GREALFREIGHTERACCOUNT' });
  });

  it('exposes isDemo and persists across remount via sessionStorage and localStorage', async () => {
    const first = renderProvider();
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText('demo'));
    expectDemoState();
    expect(sessionStorage.getItem(DEMO_MODE_KEY)).toBe('true');
    expect(localStorage.getItem(DEMO_MODE_KEY)).toBe('true');

    // Simulate page reload
    first.unmount();
    vi.clearAllMocks();
    renderProvider();

    expectDemoState();
    expect(freighterApi.isAllowed).not.toHaveBeenCalled();
  });

  it('clears persisted demo flag, resets demo store, and deactivates demo mode on disconnect', async () => {
    sessionStorage.setItem(DEMO_MODE_KEY, 'true');
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    const first = renderProvider();
    expectDemoState();

    fireEvent.click(screen.getByText('disconnect'));
    expect(sessionStorage.getItem(DEMO_MODE_KEY)).toBeNull();
    expect(localStorage.getItem(DEMO_MODE_KEY)).toBeNull();
    expect(localStorage.getItem(WALLET_DISCONNECTED_KEY)).toBe('true');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('is-demo').textContent).toBe('false');
    expect(isDemoModeActive()).toBe(false);

    first.unmount();
    renderProvider();
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('is-demo').textContent).toBe('false');
  });

  it('clears demo overlay store when resetDemo is called', async () => {
    renderProvider();
    fireEvent.click(screen.getByText('demo'));
    expectDemoState();

    // Call resetDemo
    fireEvent.click(screen.getByText('resetDemo'));
    expect(getDemoStore().vaults).toEqual({});
    expect(getDemoStore().activity).toEqual([]);
    expect(screen.getByTestId('is-demo').textContent).toBe('true');
  });
});
