import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FundReleaseStatus,
  truncateMiddle,
  type FundReleaseStatusProps,
} from '../FundReleaseStatus';
import { buildFundReleaseView } from '../../utils/vaultState';
import { MASTER_VAULTS } from '../../fixtures/vaults';
import type { Vault, VaultStatus } from '../../types/vault';
import type { WalletNetwork } from '../../context/WalletContext';

const walletState = vi.hoisted(() => ({
  address: null as string | null,
  network: 'TESTNET' as WalletNetwork | null,
}));

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const VALID_64_CHAR_HASH =
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

const BASE_VAULT: Vault = {
  ...MASTER_VAULTS['1'],
  transactions: [
    ...MASTER_VAULTS['1'].transactions,
    {
      id: 'tx-release',
      type: 'release',
      hash: VALID_64_CHAR_HASH,
      timestamp: '2026-03-01T12:00:00.000Z',
      amount: 12500,
    },
    {
      id: 'tx-redirect',
      type: 'redirect',
      hash: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1',
      timestamp: '2026-03-02T15:30:00.000Z',
      amount: 12500,
    },
  ],
};

function renderForVault(
  vaultOverrides: Partial<Vault> = {},
  propOverrides: Partial<FundReleaseStatusProps> = {},
) {
  const vault: Vault = { ...BASE_VAULT, ...vaultOverrides };
  const settlement = buildFundReleaseView(vault);
  return render(<FundReleaseStatus {...settlement} {...propOverrides} />);
}

describe('FundReleaseStatus', () => {
  beforeEach(() => {
    walletState.address = null;
    walletState.network = 'TESTNET';
  });

  describe('status matrix via buildFundReleaseView', () => {
    const statusMatrix: Array<{
      status: VaultStatus;
      expectedRegionName: string;
      expectedHeading: string;
      expectedDescription: RegExp;
      expectsLink: boolean;
      expectedDestination?: string;
    }> = [
      {
        status: 'active',
        expectedRegionName: 'Fund settlement status: Settlement pending',
        expectedHeading: 'Settlement pending',
        expectedDescription:
          /USDC remains locked until validation or deadline settlement completes\./i,
        expectsLink: false,
      },
      {
        status: 'pending_validation',
        expectedRegionName: 'Fund settlement status: Settlement pending',
        expectedHeading: 'Settlement pending',
        expectedDescription:
          /USDC remains locked until validation or deadline settlement completes\./i,
        expectsLink: false,
      },
      {
        status: 'completed',
        expectedRegionName: 'Fund settlement status: Funds released',
        expectedHeading: 'Funds released',
        expectedDescription: /USDC was released to the success destination\./i,
        expectsLink: true,
        expectedDestination: BASE_VAULT.successAddress,
      },
      {
        status: 'failed',
        expectedRegionName: 'Fund settlement status: Funds redirected',
        expectedHeading: 'Funds redirected',
        expectedDescription: /USDC was redirected to the failure destination\./i,
        expectsLink: true,
        expectedDestination: BASE_VAULT.failureAddress,
      },
      {
        status: 'cancelled',
        expectedRegionName: 'Fund settlement status: Funds redirected',
        expectedHeading: 'Funds redirected',
        expectedDescription: /USDC was redirected to the failure destination\./i,
        expectsLink: true,
        expectedDestination: BASE_VAULT.failureAddress,
      },
    ];

    it.each(statusMatrix)(
      'renders distinct settlement label and state for vault status "$status"',
      ({
        status,
        expectedRegionName,
        expectedHeading,
        expectedDescription,
        expectsLink,
        expectedDestination,
      }) => {
        renderForVault({ status });

        const region = screen.getByRole('region', { name: expectedRegionName });
        expect(region).toBeInTheDocument();

        expect(
          screen.getByRole('heading', { level: 2, name: expectedHeading }),
        ).toBeInTheDocument();
        expect(screen.getByText(expectedDescription)).toBeInTheDocument();

        if (!expectsLink) {
          expect(
            screen.getByText(
              /Settlement transaction details will appear after funds are released or redirected\./i,
            ),
          ).toBeInTheDocument();
          expect(screen.queryByRole('link')).not.toBeInTheDocument();
        } else {
          expect(
            screen.getByLabelText(`Destination address ${expectedDestination}`),
          ).toBeInTheDocument();
          const link = screen.getByRole('link', {
            name: /View transaction .* on Stellar Testnet explorer/i,
          });
          expect(link).toHaveAttribute(
            'href',
            expect.stringMatching(
              /^https:\/\/stellar\.expert\/explorer\/testnet\/tx\//,
            ),
          );
        }
      },
    );
  });

  describe('transaction hash validation and explorer links', () => {
    it('renders a testnet explorer link for completed status with a valid 64-char hash', () => {
      renderForVault({ status: 'completed' });

      const link = screen.getByRole('link', {
        name: `View transaction ${VALID_64_CHAR_HASH} on Stellar Testnet explorer`,
      });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        `https://stellar.expert/explorer/testnet/tx/${VALID_64_CHAR_HASH}`,
      );
      expect(link.getAttribute('href')?.startsWith('https://stellar.expert/explorer/testnet/tx/')).toBe(
        true,
      );
    });

    it('points the explorer link at the active PUBLIC network when wallet or prop specifies PUBLIC', () => {
      walletState.network = 'PUBLIC';
      renderForVault({ status: 'completed' });

      const link = screen.getByRole('link', {
        name: `View transaction ${VALID_64_CHAR_HASH} on Stellar Public explorer`,
      });
      expect(link).toHaveAttribute(
        'href',
        `https://stellar.expert/explorer/public/tx/${VALID_64_CHAR_HASH}`,
      );
    });

    it('prefers the explicit network prop over the wallet network for explorer links and surfaces mismatch notice', () => {
      walletState.network = 'PUBLIC';
      renderForVault({ status: 'completed' }, { network: 'TESTNET' });

      const link = screen.getByRole('link', {
        name: `View transaction ${VALID_64_CHAR_HASH} on Stellar Testnet explorer`,
      });
      expect(link).toHaveAttribute(
        'href',
        `https://stellar.expert/explorer/testnet/tx/${VALID_64_CHAR_HASH}`,
      );

      const mismatchNotice = screen.getByRole('status', {
        name: 'Network mismatch notice',
      });
      expect(mismatchNotice).toHaveTextContent(
        /This settlement belongs to the testnet contract, but your wallet is connected to mainnet/i,
      );
    });

    it.each([
      ['path traversal', 'x/../y'],
      ['too short', 'abc1234'],
      ['too long (65 chars)', 'a'.repeat(65)],
      ['scheme injection', 'javascript:alert(1)'],
      ['query injection', 'a1b2c3d4e5f6?network=public'],
      ['whitespace', 'a1b2c3d4 e5f6a7b8'],
    ])('omits explorer link for hostile or invalid hash (%s: "%s")', (_label, badHash) => {
      renderForVault(
        { status: 'completed' },
        {
          transaction: {
            hash: badHash,
            timestamp: '2026-03-01T12:00:00.000Z',
          },
        },
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText('Invalid transaction hash')).toBeInTheDocument();
    });

    it('renders "Pending transaction" without a link when transaction hash is missing', () => {
      renderForVault(
        { status: 'completed' },
        {
          transaction: {
            timestamp: '2026-03-01T12:00:00.000Z',
          },
        },
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText('Pending transaction')).toBeInTheDocument();
    });
  });

  describe('missing and unverified destination addresses & defensive bounds', () => {
    it('does not crash when destinationAddress is undefined and shows "Not available"', () => {
      renderForVault(
        { status: 'completed' },
        { destinationAddress: undefined },
      );

      expect(
        screen.getByRole('region', {
          name: 'Fund settlement status: Funds released',
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('Not available')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Destination address/i)).not.toBeInTheDocument();
    });

    it('does not crash when destinationAddress is an empty string and shows "Not available"', () => {
      renderForVault({ status: 'failed' }, { destinationAddress: '' });

      expect(
        screen.getByRole('region', {
          name: 'Fund settlement status: Funds redirected',
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('Not available')).toBeInTheDocument();
    });

    it('marks non-plausible destination addresses as (unverified) without crashing', () => {
      renderForVault(
        { status: 'completed' },
        { destinationAddress: 'not-a-stellar-address' },
      );

      const dest = screen.getByLabelText(
        'Destination address not-a-stellar-address',
      );
      expect(dest).toBeInTheDocument();
      expect(dest).toHaveTextContent('(unverified)');
    });

    it('handles invalid amount, currency, and timestamps gracefully', () => {
      renderForVault(
        { status: 'completed' },
        {
          amount: -50,
          currency: '123!',
          transaction: {
            hash: VALID_64_CHAR_HASH,
            timestamp: 'not-a-timestamp',
          },
        },
      );

      expect(screen.getByText('Unavailable UNKNOWN')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('returns "Unavailable" from truncateMiddle for empty or non-string values', () => {
      expect(truncateMiddle('')).toBe('Unavailable');
      expect(truncateMiddle(undefined as unknown as string)).toBe('Unavailable');
    });
  });
});
