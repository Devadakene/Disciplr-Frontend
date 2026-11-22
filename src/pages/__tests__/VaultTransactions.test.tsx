import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VaultTransactions from '../VaultTransactions';
import * as vaultService from '../../services/vaultService';
import type { Vault, VaultTransaction } from '../../types/vault';

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    network: 'TESTNET',
    address: null,
    isConnecting: false,
    connectDemo: vi.fn(),
  }),
}));

const mockVault: Vault = {
  id: '1',
  name: 'Alpha Vault',
  status: 'active',
  amount: 12500,
  currency: 'USDC',
  createdAt: '2026-01-01T00:00:00.000Z',
  deadline: '2026-12-31T00:00:00.000Z',
  creatorAddress: 'GBVZ3KQKM4XNQPBEZMXPOLKQKM4XNQPBEZMXPOLKQK7L',
  verifierAddress: 'GVERIF3KQKM4XNQPBEZMXPOLKQKM4XNQPBEZMXPOLKQK',
  successAddress: 'GSUCC3KQKM4XNQPBEZMXPOLKQKM4XNQPBEZMXPOLKQK',
  failureAddress: 'GFAIL3KQKM4XNQPBEZMXPOLKQKM4XNQPBEZMXPOLKQK',
  contractAddress: 'GCONT3KQKM4XNQPBEZMXPOLKQKM4XNQPBEZMXPOLKQK',
  milestones: [],
  transactions: [],
};

const mockTransactions: VaultTransaction[] = [
  {
    id: 'tx-1',
    type: 'create',
    hash: '0x11111111111111111111111111111111',
    timestamp: '2026-01-01T10:00:00.000Z',
    amount: 12500,
  },
  {
    id: 'tx-2',
    type: 'validate',
    hash: '0x22222222222222222222222222222222',
    timestamp: '2026-02-01T10:00:00.000Z',
    amount: 5000,
  },
  {
    id: 'tx-3',
    type: 'release',
    hash: '0x33333333333333333333333333333333',
    timestamp: '2026-03-01T10:00:00.000Z',
    amount: 5000,
  },
];

function renderVaultTransactions(vaultId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/vaults/${vaultId}/transactions`]}>
      <Routes>
        <Route path="/vaults/:id/transactions" element={<VaultTransactions />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('VaultTransactions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders invalid-id view without calling API when route id is hostile or invalid', async () => {
    const getVaultSpy = vi.spyOn(vaultService, 'getVault');
    const getTransactionsSpy = vi.spyOn(vaultService, 'getTransactions');

    renderVaultTransactions('__proto__');

    expect(screen.getByText(/Invalid vault identifier/i)).toBeInTheDocument();
    expect(screen.getByText(/The vault ID "__proto__" is not a valid identifier/i)).toBeInTheDocument();

    expect(getVaultSpy).not.toHaveBeenCalled();
    expect(getTransactionsSpy).not.toHaveBeenCalled();
  });

  it('renders not-found view when vault does not exist', async () => {
    vi.spyOn(vaultService, 'getVault').mockResolvedValue(undefined);
    vi.spyOn(vaultService, 'getTransactions').mockResolvedValue([]);

    renderVaultTransactions('99999');

    await waitFor(() => {
      expect(screen.getByText(/Vault not found/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No vault with ID "99999" exists/i)).toBeInTheDocument();
  });

  it('renders empty transactions state when vault has no transactions', async () => {
    vi.spyOn(vaultService, 'getVault').mockResolvedValue(mockVault);
    vi.spyOn(vaultService, 'getTransactions').mockResolvedValue([]);

    renderVaultTransactions('1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alpha Vault Transactions');
    });

    expect(screen.getByText(/No transactions found for this vault/i)).toBeInTheDocument();
    expect(document.title).toBe('Alpha Vault · Disciplr');

    // Back link is present
    const backLink = screen.getByRole('link', { name: /Back to Vault/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/vaults/1');
  });

  it('renders transaction list sorted newest first by default and allows toggling sort order', async () => {
    vi.spyOn(vaultService, 'getVault').mockResolvedValue(mockVault);
    vi.spyOn(vaultService, 'getTransactions').mockResolvedValue(mockTransactions);

    renderVaultTransactions('1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alpha Vault Transactions');
    });

    // Check document.title
    expect(document.title).toBe('Alpha Vault · Disciplr');

    // By default, newest first: tx-3 (March), tx-2 (February), tx-1 (January)
    const txElements = screen.getAllByTestId(/^vault-tx-/);
    expect(txElements).toHaveLength(3);
    expect(txElements[0]).toHaveAttribute('data-testid', 'vault-tx-tx-3');
    expect(txElements[1]).toHaveAttribute('data-testid', 'vault-tx-tx-2');
    expect(txElements[2]).toHaveAttribute('data-testid', 'vault-tx-tx-1');

    // Toggle sort order
    const sortButton = screen.getByRole('button', { name: /Toggle sort order/i });
    expect(sortButton).toHaveTextContent(/Sort: Newest first/i);

    fireEvent.click(sortButton);

    // Now oldest first: tx-1, tx-2, tx-3
    expect(sortButton).toHaveTextContent(/Sort: Oldest first/i);
    const sortedTxElements = screen.getAllByTestId(/^vault-tx-/);
    expect(sortedTxElements[0]).toHaveAttribute('data-testid', 'vault-tx-tx-1');
    expect(sortedTxElements[1]).toHaveAttribute('data-testid', 'vault-tx-tx-2');
    expect(sortedTxElements[2]).toHaveAttribute('data-testid', 'vault-tx-tx-3');

    // Toggle back to newest first
    fireEvent.click(sortButton);
    const reSortedTxElements = screen.getAllByTestId(/^vault-tx-/);
    expect(reSortedTxElements[0]).toHaveAttribute('data-testid', 'vault-tx-tx-3');
  });
});
