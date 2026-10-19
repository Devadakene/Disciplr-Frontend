import { vi, describe, beforeEach, it, expect } from 'vitest';
import type { BalanceStatus } from '@/context/WalletContext';

const walletState = vi.hoisted(() => ({
    address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890' as string | null,
    balance: '12.0000000' as string | null,
    balanceStatus: 'success' as BalanceStatus,
    balanceError: null as string | null,
    network: 'TESTNET' as const,
    disconnect: vi.fn(),
}));

vi.mock('@/context/WalletContext', () => ({
    useWallet: () => walletState,
}));

import { render, screen } from '@testing-library/react';
import { WalletBalanceChip } from '../WalletBalanceChip';

function renderChip() {
    return render(<WalletBalanceChip />);
}

describe('WalletBalanceChip', () => {
    beforeEach(() => {
        walletState.address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
        walletState.balance = '12.0000000';
        walletState.balanceStatus = 'success';
    });

    // ─── Disconnected ────────────────────────────────────────────────────────

    it('renders nothing when wallet is disconnected (address is null)', () => {
        walletState.address = null;
        const { container } = renderChip();
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when balanceStatus is idle', () => {
        walletState.balanceStatus = 'idle';
        const { container } = renderChip();
        expect(container).toBeEmptyDOMElement();
    });

    // ─── Loading ─────────────────────────────────────────────────────────────

    it('renders a skeleton placeholder during loading', () => {
        walletState.balanceStatus = 'loading';
        renderChip();

        // The inner Skeleton also renders role="status" (aria-label
        // "Loading"), so scope the query to the outer chip's own label.
        const chip = screen.getByRole('status', { name: 'Loading balance' });
        expect(chip).toBeInTheDocument();
        expect(chip).toHaveAttribute('aria-label', 'Loading balance');

        const skeleton = screen.getByTestId('skeleton');
        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('wallet-balance-skeleton');
    });

    // ─── Success ─────────────────────────────────────────────────────────────

    it('renders the USDC balance when balanceStatus is success', () => {
        renderChip();

        const chip = screen.getByTestId('wallet-balance-chip');
        expect(chip).toBeInTheDocument();
        expect(chip).toHaveTextContent('12.0000000');
        expect(chip).toHaveTextContent('USDC');
    });

    it('renders a different balance value when it changes', () => {
        walletState.balance = '99.5000000';
        renderChip();

        expect(screen.getByTestId('wallet-balance-chip')).toHaveTextContent('99.5000000');
    });

    it('renders zero balance correctly', () => {
        walletState.balance = '0.0000000';
        renderChip();

        expect(screen.getByTestId('wallet-balance-chip')).toHaveTextContent('0.0000000');
    });

    // ─── No trustline ────────────────────────────────────────────────────────

    it('renders 0.00 USDC when no trustline exists', () => {
        walletState.balanceStatus = 'no_trustline';
        renderChip();

        const chip = screen.getByTestId('wallet-balance-chip');
        expect(chip).toHaveTextContent('0.00');
        expect(chip).toHaveTextContent('USDC');
        expect(chip).toHaveClass('wallet-balance-chip--no-trustline');
        expect(chip).toHaveAttribute('title', 'No USDC trustline on this network');
    });

    // ─── Error ───────────────────────────────────────────────────────────────

    it('renders an error indicator when balanceStatus is error', () => {
        walletState.balanceStatus = 'error';
        renderChip();

        const chip = screen.getByRole('status');
        expect(chip).toBeInTheDocument();
        expect(chip).toHaveClass('wallet-balance-chip--error');
        expect(chip).toHaveTextContent('!');
        expect(chip).toHaveTextContent('USDC');
        expect(chip).toHaveAttribute('aria-label', 'Balance unavailable');
    });
});
