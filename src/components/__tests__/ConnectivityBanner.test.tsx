import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectivityBanner } from '../ConnectivityBanner';
import { useConnectivityStore } from '../../services/connectivity';

vi.mock('../../services/api', () => ({
  isApiEnabled: () => true,
  API_BASE: 'https://api.disciplr.app',
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

    expect(screen.getByText(/Disciplr service is unavailable, retrying…/i)).toBeInTheDocument();
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
