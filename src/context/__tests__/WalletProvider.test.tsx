import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import {
  WalletProvider,
  useWallet,
  DEMO_ADDRESS,
  DEMO_MODE_KEY,
  WALLET_DISCONNECTED_KEY,
  WALLET_WATCH_INTERVAL,
} from '../WalletContext';
import * as walletTelemetry from '../../utils/walletTelemetry';

type WatchParams = {
  address: string;
  network: string;
  networkPassphrase: string;
  error?: { message?: string };
};

const freighter = vi.hoisted(() => {
  const instances: Array<{
    timeout?: number;
    callback: ((params: WatchParams) => void) | null;
    watch: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];

  class FakeWatchWalletChanges {
    timeout?: number;
    callback: ((params: WatchParams) => void) | null = null;
    watch = vi.fn((cb: (params: WatchParams) => void) => {
      this.callback = cb;
      return {};
    });
    stop = vi.fn();

    constructor(timeout?: number) {
      this.timeout = timeout;
      instances.push(this);
    }
  }

  return {
    isAllowed: vi.fn(),
    setAllowed: vi.fn(),
    requestAccess: vi.fn(),
    getAddress: vi.fn(),
    getNetworkDetails: vi.fn(),
    WatchWalletChanges: FakeWatchWalletChanges,
    instances,
  };
});

const horizon = vi.hoisted(() => ({
  fetchUsdcBalance: vi.fn(),
}));

vi.mock('@stellar/freighter-api', () => ({
  isAllowed: freighter.isAllowed,
  setAllowed: freighter.setAllowed,
  requestAccess: freighter.requestAccess,
  getAddress: freighter.getAddress,
  getNetworkDetails: freighter.getNetworkDetails,
  WatchWalletChanges: freighter.WatchWalletChanges,
}));

vi.mock('../../utils/horizon', () => ({
  fetchUsdcBalance: horizon.fetchUsdcBalance,
}));

function TestConsumer() {
  const { address, network, status, sessionStatus, balance, connect, disconnect, connectDemo } =
    useWallet();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="session-status">{sessionStatus}</div>
      <div data-testid="address">{address ?? 'none'}</div>
      <div data-testid="network">{network ?? 'none'}</div>
      <div data-testid="balance">{balance ?? 'none'}</div>
      <button onClick={connect}>connect</button>
      <button onClick={disconnect}>disconnect</button>
      <button onClick={connectDemo}>demo</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <WalletProvider>
      <TestConsumer />
    </WalletProvider>,
  );

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

const latestWatcher = () => freighter.instances[freighter.instances.length - 1];

let telemetrySpy: ReturnType<typeof vi.spyOn>;

describe('WalletProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    freighter.instances.length = 0;
    telemetrySpy = vi.spyOn(walletTelemetry, 'recordWalletTelemetry');
    freighter.isAllowed.mockResolvedValue({ isAllowed: true });
    freighter.setAllowed.mockResolvedValue({ isAllowed: true });
    freighter.requestAccess.mockResolvedValue({ address: 'GOLD' });
    freighter.getAddress.mockResolvedValue({ address: 'GOLD' });
    freighter.getNetworkDetails.mockResolvedValue({ network: 'TESTNET' });
    horizon.fetchUsdcBalance.mockResolvedValue({ balance: '10.0000000', hasTrustline: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores an allowed session as connected with its network and balance', async () => {
    renderProvider();
    await flush();

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('session-status').textContent).toBe('authenticated');
    expect(screen.getByTestId('address').textContent).toBe('GOLD');
    expect(screen.getByTestId('network').textContent).toBe('TESTNET');
    expect(screen.getByTestId('balance').textContent).toBe('10.0000000');
    expect(freighter.getNetworkDetails).toHaveBeenCalled();
    expect(freighter.WatchWalletChanges).toBeDefined();
    expect(freighter.instances).toHaveLength(1);
    expect(freighter.instances[0].timeout).toBe(WALLET_WATCH_INTERVAL);
    expect(freighter.instances[0].stop).not.toHaveBeenCalled();
  });

  it('updates the address and refetches the balance when the watched account changes', async () => {
    renderProvider();
    await flush();

    horizon.fetchUsdcBalance.mockResolvedValue({ balance: '99.0000000', hasTrustline: true });
    const watcher = latestWatcher();

    await act(async () => {
      watcher.callback?.({ address: 'GNEW', network: 'TESTNET', networkPassphrase: '' });
    });
    await flush();

    expect(screen.getByTestId('address').textContent).toBe('GNEW');
    expect(screen.getByTestId('balance').textContent).toBe('99.0000000');
    expect(horizon.fetchUsdcBalance).toHaveBeenLastCalledWith(
      'GNEW',
      'TESTNET',
      expect.any(Function),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('updates the network and refetches the balance when the watched network changes', async () => {
    renderProvider();
    await flush();

    freighter.getNetworkDetails.mockResolvedValue({ network: 'PUBLIC' });
    horizon.fetchUsdcBalance.mockResolvedValue({ balance: '25.0000000', hasTrustline: true });
    const watcher = latestWatcher();

    await act(async () => {
      watcher.callback?.({ address: 'GOLD', network: 'PUBLIC', networkPassphrase: '' });
    });
    await flush();

    expect(screen.getByTestId('network').textContent).toBe('PUBLIC');
    expect(screen.getByTestId('address').textContent).toBe('GOLD');
    expect(screen.getByTestId('balance').textContent).toBe('25.0000000');
    expect(horizon.fetchUsdcBalance).toHaveBeenLastCalledWith(
      'GOLD',
      'PUBLIC',
      expect.any(Function),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('stops watching on disconnect and ignores late callbacks', async () => {
    renderProvider();
    await flush();

    const watcher = latestWatcher();
    fireEvent.click(screen.getByText('disconnect'));
    await flush();

    expect(watcher.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('address').textContent).toBe('none');
    expect(localStorage.getItem(WALLET_DISCONNECTED_KEY)).toBe('true');

    await act(async () => {
      watcher.callback?.({ address: 'GLATE', network: 'PUBLIC', networkPassphrase: '' });
    });
    await flush();

    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('address').textContent).toBe('none');
  });

  it('does not start watching a persisted demo session', async () => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    renderProvider();
    await flush();

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('network').textContent).toBe('TESTNET');
    expect(freighter.instances).toHaveLength(0);
    expect(freighter.isAllowed).not.toHaveBeenCalled();
    expect(freighter.getAddress).not.toHaveBeenCalled();
  });

  it('stops an existing watcher when demo mode takes over', async () => {
    renderProvider();
    await flush();

    const watcher = latestWatcher();
    fireEvent.click(screen.getByText('demo'));
    await flush();

    expect(watcher.stop).toHaveBeenCalledTimes(1);
    expect(freighter.instances).toHaveLength(1);
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('address').textContent).toBe(DEMO_ADDRESS);
  });

  it('stops watching when the provider unmounts', async () => {
    const view = renderProvider();
    await flush();

    const watcher = latestWatcher();
    view.unmount();

    expect(watcher.stop).toHaveBeenCalledTimes(1);
    await act(async () => {
      watcher.callback?.({ address: 'GLATE', network: 'PUBLIC', networkPassphrase: '' });
    });
  });

  it('records exactly one success event per successful connect attempt', async () => {
    localStorage.setItem(WALLET_DISCONNECTED_KEY, 'true');
    renderProvider();
    await flush();
    telemetrySpy.mockClear();

    fireEvent.click(screen.getByText('connect'));
    await flush();

    const events = telemetrySpy.mock.calls.map(([event]) => event);
    expect(events.filter((event) => event.event === 'wallet.connect.success')).toHaveLength(1);
    expect(events.filter((event) => event.event === 'wallet.connect.failure')).toHaveLength(0);
  });

  it('records exactly one failure event when the address is unavailable', async () => {
    localStorage.setItem(WALLET_DISCONNECTED_KEY, 'true');
    renderProvider();
    await flush();
    freighter.getAddress.mockResolvedValue({ address: '', error: 'User denied access' });
    telemetrySpy.mockClear();

    fireEvent.click(screen.getByText('connect'));
    await flush();

    const failures = telemetrySpy.mock.calls
      .map(([event]) => event)
      .filter((event) => event.event === 'wallet.connect.failure');
    expect(failures).toHaveLength(1);
  });

  it('records exactly one failure event when Freighter throws', async () => {
    localStorage.setItem(WALLET_DISCONNECTED_KEY, 'true');
    renderProvider();
    await flush();
    freighter.setAllowed.mockRejectedValue(new Error('Freighter crashed'));
    telemetrySpy.mockClear();

    fireEvent.click(screen.getByText('connect'));
    await flush();

    const failures = telemetrySpy.mock.calls
      .map(([event]) => event)
      .filter((event) => event.event === 'wallet.connect.failure');
    expect(failures).toHaveLength(1);
  });
});
