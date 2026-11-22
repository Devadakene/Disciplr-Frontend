import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Vaults from '../Vaults';
import { useConnectivityStore } from '../../services/connectivity';
import * as vaultService from '../../services/vaultService';

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    address: null,
    sessionStatus: 'anonymous',
    connectDemo: vi.fn(),
    isConnecting: false,
  }),
}));

vi.mock('../../components/Wallet/WalletConnectButton', () => ({
  WalletConnectButton: () => <button>Connect Wallet</button>,
}));

vi.mock('../../services/api', () => ({
  isApiEnabled: () => true,
  API_BASE: 'https://api.disciplr.app',
}));

describe('Vaults recovery on connectivity return', () => {
  beforeEach(() => {
    useConnectivityStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('triggers a refetch when status transitions from degraded to online', async () => {
    const listVaultsSpy = vi.spyOn(vaultService, 'listVaults');

    // First call rejects with network failure
    listVaultsSpy.mockRejectedValueOnce(new Error('Network error'));

    // Set connectivity degraded
    useConnectivityStore.getState().setStatus('api-down');

    render(
      <MemoryRouter>
        <Vaults />
      </MemoryRouter>
    );

    // Initial load fails
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
    expect(listVaultsSpy).toHaveBeenCalledTimes(1);

    // Second call succeeds with mock vaults
    listVaultsSpy.mockResolvedValueOnce([
      {
        id: 'vault-1',
        name: 'Recovered Vault',
        amount: 500,
        currency: 'USDC',
        status: 'active',
        createdAt: new Date().toISOString(),
        deadline: new Date(Date.now() + 86400000).toISOString(),
        creatorAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        verifierAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        successAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        failureAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        contractAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        milestones: [],
        transactions: [],
      },
    ]);

    // Simulate recovery
    act(() => {
      useConnectivityStore.getState().setStatus('online');
    });

    // Automatically refetched and rendered
    await waitFor(() => {
      expect(screen.getByText('Recovered Vault')).toBeInTheDocument();
    });
    expect(listVaultsSpy).toHaveBeenCalledTimes(2);
  });
});
