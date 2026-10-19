/**
 * Tests for issue #654 — ErrorBoundary scoped to route content, not the app chrome.
 *
 * Verifies that when a page component throws during render:
 *   - The header / nav / wallet-connect button remain in the DOM.
 *   - The broken route shows the ErrorBoundary fallback UI.
 *   - The fallback offers a "Contact support" link and a Refresh button.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';

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
