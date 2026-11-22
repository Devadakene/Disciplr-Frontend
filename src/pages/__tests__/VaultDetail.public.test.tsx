import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VaultDetail from '../VaultDetail';
import { useWallet } from '../../context/WalletContext';

// Mock useWallet
const mockConnectDemo = vi.fn();
let mockWalletState: {
  address: string | null;
  network: 'TESTNET' | 'PUBLIC' | null;
  isConnecting: boolean;
  connectDemo: () => void;
  sessionStatus: 'resolving' | 'authenticated' | 'anonymous';
} = {
  address: null,
  network: null,
  isConnecting: false,
  connectDemo: mockConnectDemo,
  sessionStatus: 'anonymous',
};

vi.mock('../../context/WalletContext', async () => {
  const actual = await vi.importActual('../../context/WalletContext');
  return {
    ...actual,
    useWallet: () => mockWalletState,
  };
});

function renderVaultDetail(vaultId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/vaults/${vaultId}`]}>
      <Routes>
        <Route path="/vaults/:id" element={<VaultDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('VaultDetail public view (unauthenticated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletState = {
      address: null,
      network: null,
      isConnecting: false,
      connectDemo: mockConnectDemo,
      sessionStatus: 'anonymous',
    };
  });

  it('renders vault data when disconnected without action buttons, showing connect CTA', async () => {
    renderVaultDetail('1');

    // Wait for vault to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alpha Vault');
    });

    // Public details should be visible
    expect(screen.getByText('Milestones')).toBeInTheDocument();
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText('Phase 1 Complete')).toBeInTheDocument();

    // Document title should reflect vault name
    expect(document.title).toBe('Alpha Vault · Disciplr');

    // Connect CTA should be present
    expect(screen.getByText(/Connect a wallet to take action/i)).toBeInTheDocument();
    expect(screen.getByText(/Try the demo account/i)).toBeInTheDocument();
    expect(screen.getByTestId('vault-connect-cta')).toBeInTheDocument();

    // Action buttons must NOT be present
    expect(screen.queryByRole('button', { name: /Validate Milestone/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Extend Deadline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel Vault/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Duplicate Vault/i })).not.toBeInTheDocument();

    // "View all" transactions link should be present
    const viewAllLink = screen.getByRole('link', { name: /View all/i });
    expect(viewAllLink).toBeInTheDocument();
    expect(viewAllLink).toHaveAttribute('href', '/vaults/1/transactions');
  });

  it('enables authorized actions when wallet connects without navigation', async () => {
    const { rerender } = renderVaultDetail('1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alpha Vault');
    });

    expect(screen.getByTestId('vault-connect-cta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel Vault/i })).not.toBeInTheDocument();

    // Now simulate wallet connecting as the creator
    mockWalletState = {
      address: 'GBVZ3KQKM4XNQPBEZMXPOLKQKM4XNQPBEZMXPOLKQK7L',
      network: 'TESTNET',
      isConnecting: false,
      connectDemo: mockConnectDemo,
      sessionStatus: 'authenticated',
    };

    rerender(
      <MemoryRouter initialEntries={['/vaults/1']}>
        <Routes>
          <Route path="/vaults/:id" element={<VaultDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Connect CTA should be gone
    expect(screen.queryByTestId('vault-connect-cta')).not.toBeInTheDocument();

    // Actions should now appear
    expect(screen.getByRole('link', { name: /Duplicate Vault/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel Vault/i })).toBeInTheDocument();
  });
});
