/**
 * Tests for issue #654 — ErrorBoundary scoped to route content, not the app chrome.
 *
 * Verifies that when a page component throws during render:
 *   - The header / nav / wallet-connect button remain in the DOM.
 *   - The broken route shows the ErrorBoundary fallback UI.
 *   - The fallback offers a "Contact support" link and a Refresh button.
 *
 * Extended for the error-recovery issue: navigating away from a crashed route
 * must drop the fallback (see the "route navigation recovery" suite below).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import { RouteErrorBoundary } from '../App';

// ---------------------------------------------------------------------------
// Module mocks — keep chrome deps from exploding in the test environment
// ---------------------------------------------------------------------------

vi.mock('../components/Wallet/WalletConnectButton', () => ({
  WalletConnectButton: () => (
    <button type="button">Connect wallet</button>
  ),
}));

vi.mock('../components/Wallet/WalletBalanceChip', () => ({
  WalletBalanceChip: () => null,
}));

vi.mock('../components/TrustlineBanner', () => ({
  TrustlineBanner: () => null,
}));

vi.mock('../components/Notification/NotificationBell', () => ({
  default: () => null,
}));

vi.mock('../components/ThemeToggle', () => ({
  default: () => <button type="button">Theme toggle</button>,
}));

vi.mock('../utils/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}));

vi.mock('../components/NetworkMismatchBanner', () => ({
  NetworkMismatchBanner: () => (
    <div data-testid="network-mismatch-banner" />
  ),
}));

vi.mock('../components/NavLink', () => ({
  default: ({
    to,
    children,
    className,
    'aria-current': ariaCurrent,
    ariaLabel,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    'aria-current'?: string;
    ariaLabel?: string;
  }) => (
    <a
      href={to}
      className={className}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  ),
}));

vi.mock('../components/MobileDrawer', () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// A page component that always throws during render
// ---------------------------------------------------------------------------
function BrokenPage(): never {
  throw new Error('Simulated render crash for testing');
}

// ---------------------------------------------------------------------------
// Helper: render Layout (which contains the ErrorBoundary) at a given path
// ---------------------------------------------------------------------------
function renderWithCrashingRoute(path = '/') {
  // Suppress the expected React error boundary console.error output
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <Layout>
        <BrokenPage />
      </Layout>
    </MemoryRouter>,
  );

  return { ...result, consoleSpy };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ErrorBoundary — scoped to route content (issue #654)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the header (banner landmark) in the DOM after a route crash', () => {
    const { consoleSpy } = renderWithCrashingRoute('/');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('keeps the main navigation in the DOM after a route crash', () => {
    const { consoleSpy } = renderWithCrashingRoute('/');
    expect(
      screen.getByRole('navigation', { name: /main navigation/i }),
    ).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('keeps the wallet-connect button in the DOM after a route crash', () => {
    const { consoleSpy } = renderWithCrashingRoute('/');
    expect(
      screen.getByRole('button', { name: /connect wallet/i }),
    ).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('renders the command palette trigger in the shared layout', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Healthy page</div>
        </Layout>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: /open command palette/i }),
    ).toBeInTheDocument();
  });

  it('shows the "Something went wrong" fallback inside main after a route crash', () => {
    const { consoleSpy } = renderWithCrashingRoute('/');
    const main = screen.getByRole('main');
    expect(main).toContainElement(
      screen.getByText(/something went wrong/i),
    );
    consoleSpy.mockRestore();
  });

  it('shows the fallback error alert with role="alert"', () => {
    const { consoleSpy } = renderWithCrashingRoute('/');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('renders a "Contact support" link inside the fallback', () => {
    const { consoleSpy } = renderWithCrashingRoute('/');
    const supportLink = screen.getByRole('link', { name: /contact support/i });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute('href', expect.stringContaining('mailto:support@disciplr.app'));
    consoleSpy.mockRestore();
  });

  it('renders a Refresh button inside the fallback', () => {
    const { consoleSpy } = renderWithCrashingRoute('/');
    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('does NOT render the broken page content', () => {
    const { consoleSpy } = renderWithCrashingRoute('/');
    // The page threw — its content should be replaced by the fallback
    expect(screen.queryByText(/simulated render crash/i)).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('a healthy child renders normally (no false-positive boundary activation)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ErrorBoundary>
          <div data-testid="healthy-page">All good</div>
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('healthy-page')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Navigation recovery
//
// React Router renders the matched element at the same tree position for every
// route, so a boundary created without `resetKeys` keeps its error state and
// the fallback sticks until a full reload. Keyed on the pathname, the boundary
// drops the error as soon as the user navigates.
// ---------------------------------------------------------------------------

function CrashingPage() {
  throw new Error('route A crashed');
}

function HealthyPage() {
  return <div data-testid="healthy-page">Vaults page</div>;
}

function GoToVaults() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/vaults')}>
      go to vaults
    </button>
  );
}

function CrashAtA() {
  const location = useLocation();
  if (location.pathname === '/a') throw new Error('layout backstop crashed');
  return <div data-testid="layout-recovered">Recovered at {location.pathname}</div>;
}

function GoToB() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/b')}>
      go to b
    </button>
  );
}

describe('ErrorBoundary — route navigation recovery', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders the destination route after navigating away from a crashed route', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <GoToVaults />
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RouteErrorBoundary>
                <CrashingPage />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/vaults"
            element={
              <RouteErrorBoundary>
                <HealthyPage />
              </RouteErrorBoundary>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go to vaults/i }));

    expect(screen.getByTestId('healthy-page')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the fallback after navigation when the boundary has no resetKeys (regression guard)', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <GoToVaults />
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ErrorBoundary variant="section">
                <CrashingPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/vaults"
            element={
              <ErrorBoundary variant="section">
                <HealthyPage />
              </ErrorBoundary>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go to vaults/i }));

    // Without `resetKeys` the same boundary instance keeps its error state and
    // the destination route never renders. Pinned so the fix cannot regress.
    expect(screen.queryByTestId('healthy-page')).toBeNull();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('resets the Layout backstop boundary when the route changes', () => {
    render(
      <MemoryRouter initialEntries={['/a']}>
        <GoToB />
        <Layout>
          <CrashAtA />
        </Layout>
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    // The chrome stays mounted and usable while a page is broken.
    expect(screen.getByRole('banner')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go to b/i }));

    expect(screen.getByTestId('layout-recovered')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
