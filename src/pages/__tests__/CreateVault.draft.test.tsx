import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CreateVault from '../CreateVault';
import Layout from '../../components/Layout';
import * as vaultService from '../../services/vaultService';
import type { Vault } from '../../types/vault';
import {
  createVaultDraft,
  getCreateVaultDraftKey,
  readDraft,
  writeDraft,
  type CreateVaultDraftValues,
} from '../../utils/createVaultDraft';
import {
  hasActiveNavigationGuard,
  resetNavigationGuards,
} from '../../utils/navigationGuard';
import { ACCOUNT_A, ACCOUNT_B, ACCOUNT_C, ACCOUNT_D } from '@/__tests__/fixtures/stellarAddresses';

const wallet = vi.hoisted(() => ({
  address: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ' as string | null,
}));

/** Mirrors the autosave debounce in CreateVault. */
const DRAFT_WRITE_DELAY_MS = 500;

vi.mock('../../context/WalletContext', () => {
  const mockWallet = () => ({
    address: wallet.address,
    network: 'TESTNET',
    balance: '10000',
    balanceStatus: 'success',
    isConnecting: false,
    isDemo: false,
    error: null,
    connect: async () => true,
    disconnect: () => {},
    checkConnection: async () => {},
    connectDemo: () => {},
    resetDemo: () => {},
  });
  return { useWallet: mockWallet, useOptionalWallet: mockWallet };
});

// Keep the shared chrome light: these surfaces are irrelevant to drafting.
vi.mock('../../components/Wallet/WalletConnectButton', () => ({
  WalletConnectButton: () => <button type="button">Connect wallet</button>,
}));
vi.mock('../../components/Notification/NotificationBell', () => ({
  default: () => null,
}));
vi.mock('../../components/TrustlineBanner', () => ({ TrustlineBanner: () => null }));
vi.mock('../../components/MobileDrawer', () => ({ default: () => null }));
vi.mock('../../components/CommandPalette', () => ({ default: () => null }));
vi.mock('../../components/ThemeToggle', () => ({ default: () => null }));
vi.mock('../../components/ShortcutsHelp', () => ({ ShortcutsHelp: () => null }));
vi.mock('../../components/ToastViewport', () => ({ ToastViewport: () => null }));

const draftValues = (): CreateVaultDraftValues => ({
  amount: '250',
  deadline: '2030-01-01T12:00',
  successAddress: ACCOUNT_B,
  failureAddress: ACCOUNT_C,
  milestones: [
    { title: 'Second milestone', criteria: 'second criteria' },
    { title: 'First milestone', criteria: 'first criteria' },
  ],
  evidenceUrl: 'https://example.com/proof',
});

function renderCreateVault(
  initialEntry: string | { pathname: string; state?: unknown } = '/vaults/create',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/vaults/create" element={<CreateVault />} />
        <Route path="/vaults/:id" element={<div>Vault Detail Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const input = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement;

function fillValidForm() {
  fireEvent.change(input(/vault name/i), { target: { value: 'Draft vault' } });
  fireEvent.change(input(/verifier address/i), { target: { value: ACCOUNT_D } });
  fireEvent.change(input(/amount \(usdc\)/i), { target: { value: '100' } });
  fireEvent.change(input(/deadline/i), { target: { value: '2030-01-01T12:00' } });
  fireEvent.change(input(/success destination/i), { target: { value: ACCOUNT_B } });
  fireEvent.change(input(/failure destination/i), { target: { value: ACCOUNT_C } });
}

const createdVault = { id: 'vault-draft-1' } as Vault;

describe('CreateVault draft persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    resetNavigationGuards();
    vi.restoreAllMocks();
    wallet.address = ACCOUNT_A;
  });

  afterEach(() => {
    cleanup();
    resetNavigationGuards();
    vi.useRealTimers();
  });

  it('autosaves the draft only after the debounce window elapses', () => {
    renderCreateVault();

    fireEvent.change(input(/amount \(usdc\)/i), { target: { value: '100' } });

    act(() => {
      vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS - 1);
    });
    expect(readDraft(ACCOUNT_A)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    const draft = readDraft(ACCOUNT_A);
    expect(draft?.amount).toBe('100');
    expect(draft?.milestones).toEqual([
      { title: 'Milestone 1', criteria: 'Default milestone criteria' },
    ]);
  });

  it('offers a saved draft and restores every field, including milestone order', () => {
    writeDraft(ACCOUNT_A, createVaultDraft(draftValues()));
    renderCreateVault();

    const banner = screen.getByTestId('create-vault-draft-banner');
    fireEvent.click(within(banner).getByRole('button', { name: /^restore$/i }));

    expect(screen.queryByTestId('create-vault-draft-banner')).toBeNull();
    expect(input(/amount \(usdc\)/i).value).toBe('250');
    expect(input(/deadline/i).value).toBe('2030-01-01T12:00');
    expect(input(/success destination/i).value).toBe(ACCOUNT_B);
    expect(input(/failure destination/i).value).toBe(ACCOUNT_C);
    expect(input(/evidence url/i).value).toBe('https://example.com/proof');
    expect(input(/milestone 1 title/i).value).toBe('Second milestone');
    expect(input(/milestone 1 criteria/i).value).toBe('second criteria');
    expect(input(/milestone 2 title/i).value).toBe('First milestone');
  });

  it('re-validates restored values before they can reach the review step', () => {
    writeDraft(
      ACCOUNT_A,
      createVaultDraft({ ...draftValues(), amount: '0', deadline: '2000-01-01T00:00' }),
    );
    renderCreateVault();

    const banner = screen.getByTestId('create-vault-draft-banner');
    fireEvent.click(within(banner).getByRole('button', { name: /^restore$/i }));

    // Restored text is re-validated, so it can never reach "ready to review".
    expect(screen.getByRole('alert')).toHaveTextContent(/positive USDC amount/i);
    fireEvent.click(screen.getByRole('button', { name: /^create vault$/i }));
    expect(screen.queryByRole('heading', { name: /review vault details/i })).toBeNull();
  });

  it('discards the draft so the banner does not return on reload', () => {
    writeDraft(ACCOUNT_A, createVaultDraft(draftValues()));
    const first = renderCreateVault();

    const banner = screen.getByTestId('create-vault-draft-banner');
    fireEvent.click(within(banner).getByRole('button', { name: /^discard$/i }));

    expect(screen.queryByTestId('create-vault-draft-banner')).toBeNull();
    expect(window.localStorage.getItem(getCreateVaultDraftKey(ACCOUNT_A)!)).toBeNull();

    first.unmount();
    renderCreateVault();
    expect(screen.queryByTestId('create-vault-draft-banner')).toBeNull();
  });

  it('never offers a draft over a Duplicate prefill', () => {
    writeDraft(ACCOUNT_A, createVaultDraft(draftValues()));

    renderCreateVault({
      pathname: '/vaults/create',
      state: {
        createVaultPrefill: {
          sourceVaultName: 'Alpha',
          amount: '100',
          successAddress: ACCOUNT_B,
          failureAddress: ACCOUNT_C,
          milestones: [{ title: 'Milestone 1', criteria: 'Criteria 1' }],
        },
      },
    });

    expect(screen.queryByTestId('create-vault-draft-banner')).toBeNull();
    expect(input(/amount \(usdc\)/i).value).toBe('100');
    // The prefill is untouched, so there is nothing unsaved to warn about.
    expect(hasActiveNavigationGuard()).toBe(false);
  });

  it("never offers another wallet's draft", () => {
    writeDraft(ACCOUNT_B, createVaultDraft(draftValues()));
    renderCreateVault();

    expect(screen.queryByTestId('create-vault-draft-banner')).toBeNull();
  });

  it('clears the draft after a confirmed create succeeds', async () => {
    vi.spyOn(vaultService, 'createVault').mockResolvedValue(createdVault);
    renderCreateVault();
    fillValidForm();

    act(() => {
      vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    });
    expect(readDraft(ACCOUNT_A)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^create vault$/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm vault/i }));
    });
    await act(async () => {});

    expect(screen.getByText('Vault Detail Page')).toBeInTheDocument();
    expect(readDraft(ACCOUNT_A)).toBeNull();
  });

  it('keeps the draft when the create outcome is unknown', async () => {
    vi.spyOn(vaultService, 'createVault').mockRejectedValue(new Error('network down'));
    renderCreateVault();
    fillValidForm();

    act(() => {
      vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    });
    expect(readDraft(ACCOUNT_A)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^create vault$/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm vault/i }));
    });
    // An unknown outcome now triggers reconciliation (two lookups 250ms
    // apart); offline fixtures hold no matching vault.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(screen.getByText(/no matching vault was found/i)).toBeInTheDocument();
    expect(readDraft(ACCOUNT_A)?.amount).toBe('100');
  });

  it('attaches the beforeunload handler only while the form is dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const beforeUnloadRegistrations = () =>
      addSpy.mock.calls.filter(([type]) => type === 'beforeunload');

    renderCreateVault();
    expect(beforeUnloadRegistrations()).toHaveLength(0);
    expect(hasActiveNavigationGuard()).toBe(false);

    fireEvent.change(input(/amount \(usdc\)/i), { target: { value: '100' } });

    expect(beforeUnloadRegistrations()).toHaveLength(1);
    expect(hasActiveNavigationGuard()).toBe(true);
  });
});

describe('CreateVault leave-page protection', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetNavigationGuards();
    vi.restoreAllMocks();
    wallet.address = ACCOUNT_A;
  });

  afterEach(() => {
    cleanup();
    resetNavigationGuards();
  });

  function renderWithChrome() {
    return render(
      <MemoryRouter initialEntries={['/vaults/create']}>
        <Layout>
          <Routes>
            <Route path="/vaults/create" element={<CreateVault />} />
            <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          </Routes>
        </Layout>
      </MemoryRouter>,
    );
  }

  it('confirms before following a header nav link, and Cancel keeps the user on the form', () => {
    renderWithChrome();
    fireEvent.change(input(/amount \(usdc\)/i), { target: { value: '100' } });

    fireEvent.click(screen.getByRole('link', { name: /^dashboard$/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Page')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Dashboard Page')).toBeNull();
    expect(input(/amount \(usdc\)/i).value).toBe('100');
  });

  it('navigates immediately when the form is pristine', () => {
    renderWithChrome();

    fireEvent.click(screen.getByRole('link', { name: /^dashboard$/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});
