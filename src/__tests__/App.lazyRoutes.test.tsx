import { describe, it, expect, vi } from 'vitest';

vi.mock('../pages/Analytics', () => ({ default: () => <div>Analytics</div> }));
vi.mock('../pages/Notification', () => ({ default: () => <div>Notification</div> }));
vi.mock('../pages/Home', () => ({ default: () => <div>Home</div> }));
vi.mock('../pages/Dashboard', () => ({ default: () => <div>Dashboard</div> }));
vi.mock('../pages/Vaults', () => ({ default: () => <div>Vaults</div> }));
vi.mock('../pages/CreateVault', () => ({ default: () => <div>CreateVault</div> }));
vi.mock('../pages/VaultDetail', () => ({ default: () => <div>VaultDetail</div> }));
vi.mock('../pages/VaultTransactions', () => ({ default: () => <div>VaultTransactions</div> }));
vi.mock('../pages/VerifierDashboard', () => ({ default: () => <div>VerifierDashboard</div> }));
vi.mock('../pages/PendingValidations', () => ({ default: () => <div>PendingValidations</div> }));
vi.mock('../pages/ValidationDetail', () => ({ default: () => <div>ValidationDetail</div> }));
vi.mock('../pages/ValidationHistory', () => ({ default: () => <div>ValidationHistory</div> }));
vi.mock('../pages/NotFound', () => ({ default: () => <div>NotFound</div> }));
vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../components/Skeleton', () => ({ default: () => <div data-testid="skeleton">Skeleton</div> }));
vi.mock('../components/ErrorBoundary', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../context/WalletContext', () => ({ WalletProvider: ({ children }: any) => <>{children}</> }));
vi.mock('../context/ThemeContext', () => ({ ThemeProvider: ({ children }: any) => <>{children}</> }));

describe('App lazy routes', () => {
  it('should verify Analytics is imported via lazy()', async () => {
    const appSource = await import('../App?raw');
    expect(appSource.default).toContain("lazy(() => import('./pages/Analytics'))");
  });

  it('should verify Notification is imported via lazy()', async () => {
    const appSource = await import('../App?raw');
    expect(appSource.default).toContain("lazy(() => import('./pages/Notification'))");
  });
});
