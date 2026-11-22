import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectivityBanner } from '../ConnectivityBanner';
import { useConnectivityStore } from '../../services/connectivity';

vi.mock('../../services/api', () => ({
  isApiEnabled: () => true,
  API_BASE: 'https://api.disciplr.app',
}));

// Keep useCurrentTime returning a stable value so relative timestamps are deterministic.
vi.mock('../../hooks/useCurrentTime', () => ({
  useCurrentTime: () => 1_700_000_000_000,
}));

describe('ConnectivityBanner', () => {
  beforeEach(() => {
    useConnectivityStore.getState().reset();
  });

  it('renders nothing when status is online', () => {
    useConnectivityStore.getState().setStatus('online');
    const { container } = render(<ConnectivityBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders offline message with role="status" and aria-live="polite" when offline', () => {
    useConnectivityStore.getState().setStatus('offline');
    render(<ConnectivityBanner />);

    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry now/i })).toBeInTheDocument();
  });

  it('renders service unavailable message when api is down', () => {
    useConnectivityStore.getState().setStatus('api-down');
    render(<ConnectivityBanner />);

    expect(screen.getByText(/Disciplr service is unavailable/i)).toBeInTheDocument();
  });

  it('shows since text when api-down and degradedSince is set', () => {
    // degradedSince is 2 minutes before the mocked now (1_700_000_000_000)
    const degradedSince = 1_700_000_000_000 - 2 * 60 * 1000;
    useConnectivityStore.setState({ status: 'api-down', degradedSince });
    render(<ConnectivityBanner />);

    expect(screen.getByText(/since/i)).toBeInTheDocument();
  });

  it('does not show since text when offline', () => {
    useConnectivityStore.setState({ status: 'offline', degradedSince: null });
    render(<ConnectivityBanner />);

    expect(screen.queryByText(/since/i)).toBeNull();
  });

  it('does not show since text when degradedSince is null', () => {
    useConnectivityStore.setState({ status: 'api-down', degradedSince: null });
    render(<ConnectivityBanner />);

    expect(screen.queryByText(/since/i)).toBeNull();
  });

  it('triggers retryNow when "Retry now" button is clicked', async () => {
    const retrySpy = vi.fn().mockResolvedValue(true);
    useConnectivityStore.setState({ retryNow: retrySpy, status: 'api-down' });

    render(<ConnectivityBanner />);
    const retryBtn = screen.getByRole('button', { name: /Retry now/i });
    fireEvent.click(retryBtn);

    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
