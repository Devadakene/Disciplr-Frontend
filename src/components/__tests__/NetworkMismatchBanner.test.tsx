import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NetworkMismatchBanner } from '../NetworkMismatchBanner';
import type { WalletNetwork } from '../../context/WalletContext';

const walletState = vi.hoisted(() => ({
  address: null as string | null,
  network: null as WalletNetwork | null,
}));

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const telemetryMocks = vi.hoisted(() => ({
  recordWalletTelemetry: vi.fn(),
}));

vi.mock('../../utils/walletTelemetry', () => ({
  recordWalletTelemetry: telemetryMocks.recordWalletTelemetry,
}));

function setWalletState(address: string | null, network: WalletNetwork | null) {
  walletState.address = address;
  walletState.network = network;
}

describe('NetworkMismatchBanner', () => {
  beforeEach(() => {
    telemetryMocks.recordWalletTelemetry.mockClear();
  });

  it('shows a danger alert when a connected wallet is on the wrong network', () => {
    setWalletState('GABC', 'PUBLIC');

    render(<NetworkMismatchBanner expectedNetwork="TESTNET" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Wrong wallet network');
    expect(alert).toHaveTextContent('Mainnet');
    expect(alert).toHaveTextContent('Testnet');
    expect(
      screen.getByRole('link', { name: /switch freighter network/i }),
    ).toHaveAttribute('href', expect.stringContaining('freighter'));
  });

  it('stays hidden when networks match or the wallet is disconnected', () => {
    setWalletState('GABC', 'TESTNET');
    const { rerender } = render(<NetworkMismatchBanner expectedNetwork="TESTNET" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    setWalletState(null, 'PUBLIC');
    rerender(<NetworkMismatchBanner expectedNetwork="TESTNET" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can be dismissed for the current mismatch and returns for a new mismatch', () => {
    setWalletState('GABC', 'PUBLIC');
    const { rerender } = render(<NetworkMismatchBanner expectedNetwork="TESTNET" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss network mismatch warning/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    setWalletState('GABC', 'TESTNET');
    rerender(<NetworkMismatchBanner expectedNetwork="TESTNET" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    setWalletState('GABC', 'PUBLIC');
    rerender(<NetworkMismatchBanner expectedNetwork="TESTNET" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('emits mismatch_shown telemetry when a mismatch appears', () => {
    setWalletState('GABC', 'PUBLIC');

    render(<NetworkMismatchBanner expectedNetwork="TESTNET" />);

    expect(telemetryMocks.recordWalletTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'wallet.network.mismatch_shown',
        network: 'PUBLIC',
        expectedNetwork: 'TESTNET',
      }),
    );
  });

  it('does not re-emit shown telemetry on unrelated re-renders', () => {
    setWalletState('GABC', 'PUBLIC');
    const { rerender } = render(<NetworkMismatchBanner expectedNetwork="TESTNET" />);
    expect(telemetryMocks.recordWalletTelemetry).toHaveBeenCalledTimes(1);

    rerender(<NetworkMismatchBanner expectedNetwork="TESTNET" />);

    expect(telemetryMocks.recordWalletTelemetry).toHaveBeenCalledTimes(1);
  });

  it('emits recovered telemetry when the wallet returns to the expected network', () => {
    setWalletState('GABC', 'PUBLIC');
    const { rerender } = render(<NetworkMismatchBanner expectedNetwork="TESTNET" />);
    expect(telemetryMocks.recordWalletTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'wallet.network.mismatch_shown' }),
    );

    setWalletState('GABC', 'TESTNET');
    rerender(<NetworkMismatchBanner expectedNetwork="TESTNET" />);

    expect(telemetryMocks.recordWalletTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'wallet.network.recovered',
        network: 'TESTNET',
        expectedNetwork: 'TESTNET',
      }),
    );
  });

  it('emits dismissed telemetry when the warning is dismissed', () => {
    setWalletState('GABC', 'PUBLIC');

    render(<NetworkMismatchBanner expectedNetwork="TESTNET" />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss network mismatch warning/i }));

    expect(telemetryMocks.recordWalletTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'wallet.network.dismissed',
        network: 'PUBLIC',
        expectedNetwork: 'TESTNET',
      }),
    );
  });
});
