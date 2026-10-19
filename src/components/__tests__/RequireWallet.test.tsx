import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import RequireWallet from '../RequireWallet';

// Mock WalletContext
const mockUseWallet = vi.fn();
vi.mock('../../context/WalletContext', () => ({
  useWallet: () => mockUseWallet(),
}));

// Lightweight stub so we don't pull in Freighter APIs
vi.mock('../Wallet/WalletConnectButton', () => ({
  WalletConnectButton: () => <button>Connect Wallet</button>,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search + location.hash}</div>;
}

function renderInRouter(ui: React.ReactNode, initialEntry = '/vaults/create') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      {ui}
      <LocationDisplay />
    </MemoryRouter>
  );
}

describe('RequireWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children when wallet is authenticated', () => {
    mockUseWallet.mockReturnValue({
      address: 'GADDR123',
      isConnecting: false,
      sessionStatus: 'authenticated',
      connectDemo: vi.fn(),
    });

    renderInRouter(<RequireWallet><div>Protected content</div></RequireWallet>);

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /connect your wallet/i })).not.toBeInTheDocument();
  });

  it('shows connect prompt when wallet is anonymous (disconnected)', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: false,
      sessionStatus: 'anonymous',
      connectDemo: vi.fn(),
    });

    renderInRouter(<RequireWallet><div>Protected content</div></RequireWallet>);

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('shows connecting state message while connecting in anonymous state', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: true,
      sessionStatus: 'anonymous',
      connectDemo: vi.fn(),
    });

    renderInRouter(<RequireWallet><div>Protected content</div></RequireWallet>);

    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('has an accessible landmark with labelled heading', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: false,
      sessionStatus: 'anonymous',
      connectDemo: vi.fn(),
    });

    renderInRouter(<RequireWallet><div>Protected content</div></RequireWallet>);

    const region = screen.getByRole('main', { name: /connect your wallet/i });
    expect(region).toBeInTheDocument();
  });

  // Acceptance Criterion 1:
  // Cold-loading /vaults/create with Freighter allowed shows a skeleton, then the form.
  // The connect prompt never renders (assert with RTL queryByText).
  it('criterion 1: cold-loading /vaults/create with Freighter allowed shows skeleton then form without ever showing connect prompt', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: true,
      sessionStatus: 'resolving',
      connectDemo: vi.fn(),
    });

    const { rerender } = renderInRouter(
      <RequireWallet>
        <form data-testid="create-vault-form">Vault Form</form>
      </RequireWallet>,
      '/vaults/create'
    );

    // Skeleton shown with aria-busy and visually hidden Checking wallet…
    expect(screen.getByTestId('require-wallet-resolving')).toBeInTheDocument();
    expect(screen.getByText('Checking wallet…')).toBeInTheDocument();
    // Connect prompt never renders
    expect(screen.queryByText(/connect your wallet/i)).toBeNull();
    // Children not mounted yet
    expect(screen.queryByTestId('create-vault-form')).toBeNull();

    // Now resolve auth
    mockUseWallet.mockReturnValue({
      address: 'GALLOWED123',
      isConnecting: false,
      sessionStatus: 'authenticated',
      connectDemo: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={['/vaults/create']}>
        <RequireWallet>
          <form data-testid="create-vault-form">Vault Form</form>
        </RequireWallet>
        <LocationDisplay />
      </MemoryRouter>
    );

    expect(screen.getByTestId('create-vault-form')).toBeInTheDocument();
    expect(screen.queryByText(/connect your wallet/i)).toBeNull();
    expect(screen.queryByTestId('require-wallet-resolving')).toBeNull();
  });

  // Acceptance Criterion 2:
  // Cold-loading with Freighter not allowed shows the connect prompt after resolution.
  it('criterion 2: cold-loading with Freighter not allowed shows connect prompt after resolution', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: true,
      sessionStatus: 'resolving',
      connectDemo: vi.fn(),
    });

    const { rerender } = renderInRouter(
      <RequireWallet>
        <div>Protected page</div>
      </RequireWallet>,
      '/vaults/create'
    );

    expect(screen.getByTestId('require-wallet-resolving')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /connect your wallet/i })).toBeNull();
    expect(screen.queryByText('Protected page')).toBeNull();

    // Resolves as not allowed (anonymous)
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: false,
      sessionStatus: 'anonymous',
      connectDemo: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={['/vaults/create']}>
        <RequireWallet>
          <div>Protected page</div>
        </RequireWallet>
        <LocationDisplay />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
    expect(screen.queryByTestId('require-wallet-resolving')).toBeNull();
    expect(screen.queryByText('Protected page')).toBeNull();
  });

  // Acceptance Criterion 3:
  // Navigate /vaults/1 → /vaults/2, disconnect, reconnect: the URL stays /vaults/2.
  it('criterion 3: disconnect and reconnect preserves current location (/vaults/2) without resetting to initial', () => {
    mockUseWallet.mockReturnValue({
      address: 'GADDR1',
      isConnecting: false,
      sessionStatus: 'authenticated',
      connectDemo: vi.fn(),
    });

    // Start at /vaults/2
    const { rerender } = renderInRouter(
      <RequireWallet>
        <div>Vault 2 Content</div>
      </RequireWallet>,
      '/vaults/2'
    );

    expect(screen.getByText('Vault 2 Content')).toBeInTheDocument();
    expect(screen.getByTestId('location-display').textContent).toBe('/vaults/2');

    // Disconnect
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: false,
      sessionStatus: 'anonymous',
      connectDemo: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={['/vaults/2']}>
        <RequireWallet>
          <div>Vault 2 Content</div>
        </RequireWallet>
        <LocationDisplay />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
    expect(screen.getByTestId('location-display').textContent).toBe('/vaults/2');

    // Reconnect
    mockUseWallet.mockReturnValue({
      address: 'GADDR1',
      isConnecting: false,
      sessionStatus: 'authenticated',
      connectDemo: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={['/vaults/2']}>
        <RequireWallet>
          <div>Vault 2 Content</div>
        </RequireWallet>
        <LocationDisplay />
      </MemoryRouter>
    );

    expect(screen.getByText('Vault 2 Content')).toBeInTheDocument();
    expect(screen.getByTestId('location-display').textContent).toBe('/vaults/2');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // Acceptance Criterion 4:
  // The hash is preserved (/verifier/queue/abc#notes stays intact through connect).
  it('criterion 4: the hash is preserved (/verifier/queue/abc#notes stays intact through connect)', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: false,
      sessionStatus: 'anonymous',
      connectDemo: vi.fn(),
    });

    const { rerender } = renderInRouter(
      <RequireWallet>
        <div>Queue Item Notes</div>
      </RequireWallet>,
      '/verifier/queue/abc#notes'
    );

    expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
    expect(screen.getByTestId('location-display').textContent).toBe('/verifier/queue/abc#notes');

    // Connect
    mockUseWallet.mockReturnValue({
      address: 'GADDR_VERIFIER',
      isConnecting: false,
      sessionStatus: 'authenticated',
      connectDemo: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={['/verifier/queue/abc#notes']}>
        <RequireWallet>
          <div>Queue Item Notes</div>
        </RequireWallet>
        <LocationDisplay />
      </MemoryRouter>
    );

    expect(screen.getByText('Queue Item Notes')).toBeInTheDocument();
    expect(screen.getByTestId('location-display').textContent).toBe('/verifier/queue/abc#notes');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // Acceptance Criterion 5:
  // An already-connected mount triggers no navigate calls (spy).
  it('criterion 5: an already-connected mount triggers no navigate calls', () => {
    mockUseWallet.mockReturnValue({
      address: 'GADDR_CONNECTED',
      isConnecting: false,
      sessionStatus: 'authenticated',
      connectDemo: vi.fn(),
    });

    renderInRouter(
      <RequireWallet>
        <div>Protected Dashboard</div>
      </RequireWallet>,
      '/vaults/create'
    );

    expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // Acceptance Criterion 6:
  // If isAllowed never resolves, the guard falls back to the connect prompt after the cap (5s).
  it('criterion 6: if isAllowed never resolves, the guard falls back to connect prompt after the 5s cap', () => {
    vi.useFakeTimers();

    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: true,
      sessionStatus: 'resolving',
      connectDemo: vi.fn(),
    });

    renderInRouter(
      <RequireWallet>
        <div>Protected Area</div>
      </RequireWallet>,
      '/vaults/create'
    );

    expect(screen.getByTestId('require-wallet-resolving')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /connect your wallet/i })).toBeNull();

    // Advance 4999ms - still resolving
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByTestId('require-wallet-resolving')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /connect your wallet/i })).toBeNull();

    // Advance 1ms to reach 5000ms cap
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Should have timed out and fallen back to connect prompt
    expect(screen.queryByTestId('require-wallet-resolving')).toBeNull();
    expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument();
    expect(screen.queryByText('Protected Area')).toBeNull();
  });
});
