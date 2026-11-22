import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MASTER_VAULTS } from '../../fixtures/vaults';
import { truncateMiddle } from '../../utils/truncate';
import { VaultMetaPanel } from '../VaultMetaPanel';

const fixtureVault = Object.values(MASTER_VAULTS)[0];

describe('VaultMetaPanel', () => {
  it('renders all address roles with their labels and shortened addresses exposing full values', () => {
    render(
      <VaultMetaPanel
        network="TESTNET"
        creatorAddress={fixtureVault.creatorAddress}
        verifierAddress={fixtureVault.verifierAddress}
        successAddress={fixtureVault.successAddress}
        failureAddress={fixtureVault.failureAddress}
        contractAddress={fixtureVault.contractAddress}
      />,
    );

    const section = screen.getByRole('region', { name: 'Vault metadata' });
    expect(within(section).getByText('Addresses')).toBeInTheDocument();

    const rows = within(section).getAllByRole('row');
    expect(rows).toHaveLength(5);

    const expectedRoles = [
      { label: /creator/i, address: fixtureVault.creatorAddress },
      { label: /verifier/i, address: fixtureVault.verifierAddress! },
      { label: /success destination/i, address: fixtureVault.successAddress },
      { label: /failure destination/i, address: fixtureVault.failureAddress },
      { label: /contract/i, address: fixtureVault.contractAddress },
    ];

    for (const { label, address } of expectedRoles) {
      expect(screen.getByText(label)).toBeInTheDocument();

      const expectedTruncated = truncateMiddle(address, 6, 4);
      const addressNode = screen.getByLabelText(new RegExp(address));
      expect(addressNode).toBeInTheDocument();
      expect(addressNode).toHaveTextContent(expectedTruncated);
      expect(addressNode.textContent).not.toBe(address);
      expect(screen.getByTitle(new RegExp(address))).toBe(addressNode);
    }
  });

  it('omits the verifier row when verifierAddress is not provided', () => {
    render(
      <VaultMetaPanel
        network="TESTNET"
        creatorAddress={fixtureVault.creatorAddress}
        successAddress={fixtureVault.successAddress}
        failureAddress={fixtureVault.failureAddress}
        contractAddress={fixtureVault.contractAddress}
      />,
    );

    expect(screen.queryByText(/verifier/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText(/creator/i)).toBeInTheDocument();
    expect(screen.getByText(/success destination/i)).toBeInTheDocument();
    expect(screen.getByText(/failure destination/i)).toBeInTheDocument();
    expect(screen.getByText(/contract/i)).toBeInTheDocument();
  });

  it('does not render an empty verifier label when verifierAddress is an empty string', () => {
    render(
      <VaultMetaPanel
        network={null}
        creatorAddress={fixtureVault.creatorAddress}
        verifierAddress=""
        successAddress={fixtureVault.successAddress}
        failureAddress={fixtureVault.failureAddress}
        contractAddress={fixtureVault.contractAddress}
      />,
    );

    expect(screen.queryByText(/verifier/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });
});
