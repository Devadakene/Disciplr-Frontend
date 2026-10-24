import type { Page, Route, Request } from '@playwright/test';

export interface ApiMilestone {
  id: string;
  title: string;
  amount: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface ApiActivity {
  id: string;
  type: 'create' | 'validate' | 'release' | 'redirect';
  vaultId: string;
  amount: string;
  status: 'confirmed' | 'pending' | 'failed';
  hash: string;
  memo: string;
  createdAt: string;
}

export interface ApiVault {
  id: string;
  name?: string;
  creator: string;
  amount: string;
  status: 'active' | 'pending_validation' | 'completed' | 'failed' | 'cancelled';
  startDate: string;
  endDate: string;
  verifier: string;
  successDestination: string;
  failureDestination: string;
  createdAt: string;
  updatedAt: string;
  milestones: ApiMilestone[];
  activity?: ApiActivity[];
}

export const DEMO_ADDRESS = 'GBVAQKGA5P4TIZSZJBS5AW3XNJOTYG6I3Y5CLIGCBBUZDHMVF7YE7XCQ';
// Valid checksummed SEP-23 Stellar public keys:
export const SUCCESS_DESTINATION = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
export const FAILURE_DESTINATION = 'GABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEJXA';
export const VERIFIER_ADDRESS = 'GABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQHGPC';

export function createDefaultSeedVault(): ApiVault {
  return {
    id: 'seed-vault-1',
    name: 'Seed Active Vault',
    creator: DEMO_ADDRESS,
    verifier: DEMO_ADDRESS,
    amount: '2000',
    status: 'active',
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    successDestination: SUCCESS_DESTINATION,
    failureDestination: FAILURE_DESTINATION,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    milestones: [
      {
        id: 'seed-m-1',
        title: 'Initial Alpha Milestone',
        amount: '1000',
        dueDate: '2026-11-15T00:00:00.000Z',
        status: 'pending',
      },
      {
        id: 'seed-m-2',
        title: 'Final Beta Milestone',
        amount: '1000',
        dueDate: '2026-12-31T00:00:00.000Z',
        status: 'pending',
      },
    ],
    activity: [
      {
        id: 'seed-act-1',
        type: 'create',
        vaultId: 'seed-vault-1',
        amount: '2000',
        status: 'confirmed',
        hash: '0xseedcreate00000000000000000000000000000001',
        memo: 'Seed vault created',
        createdAt: '2026-10-01T00:00:00.000Z',
      },
    ],
  };
}

export class FakeApi {
  private vaults: Map<string, ApiVault> = new Map();
  private transactions: ApiActivity[] = [];
  private nextVaultIndex = 1;

  constructor(initialVaults: ApiVault[] = [createDefaultSeedVault()]) {
    this.reset(initialVaults);
  }

  public reset(initialVaults: ApiVault[] = [createDefaultSeedVault()]) {
    this.vaults.clear();
    this.transactions = [];
    this.nextVaultIndex = 1;

    for (const v of initialVaults) {
      this.seedVault(v);
    }
  }

  public seedVault(vault: ApiVault) {
    this.vaults.set(vault.id, JSON.parse(JSON.stringify(vault)));
    if (vault.activity) {
      for (const a of vault.activity) {
        if (!this.transactions.some((t) => t.id === a.id)) {
          this.transactions.push({ ...a });
        }
      }
    }
  }

  public getVault(id: string): ApiVault | undefined {
    const v = this.vaults.get(id);
    return v ? JSON.parse(JSON.stringify(v)) : undefined;
  }

  public async handleRoute(route: Route, request: Request) {
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();

    // 1. GET /vaults
    if (method === 'GET' && (path === '/vaults' || path === '/vaults/')) {
      const allVaults = Array.from(this.vaults.values()).map((v) => ({
        ...v,
        activity: this.transactions.filter((t) => t.vaultId === v.id),
      }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: allVaults }),
      });
    }

    // 2. POST /vaults
    if (method === 'POST' && (path === '/vaults' || path === '/vaults/')) {
      const body = request.postDataJSON();
      const vaultId = `v-${Date.now()}-${this.nextVaultIndex++}`;
      const nowIso = new Date().toISOString();

      const milestones: ApiMilestone[] = (body.milestones || []).map((m: any, idx: number) => ({
        id: `m-${vaultId}-${idx + 1}`,
        title: m.title || `Milestone ${idx + 1}`,
        amount: String(m.amount ?? (Number(body.amount) / Math.max(1, body.milestones?.length || 1)).toFixed(7)),
        dueDate: m.dueDate || body.endDate || nowIso,
        status: 'pending',
      }));

      const createTx: ApiActivity = {
        id: `tx-create-${vaultId}`,
        type: 'create',
        vaultId,
        amount: String(body.amount),
        status: 'confirmed',
        hash: `0xcreated${vaultId.replace(/[^a-zA-Z0-9]/g, '')}000000000000000000`,
        memo: `Vault created: ${body.name || vaultId}`,
        createdAt: nowIso,
      };

      const newVault: ApiVault = {
        id: vaultId,
        name: body.name || `Vault ${vaultId}`,
        creator: body.creator || DEMO_ADDRESS,
        verifier: body.verifier || body.creator || DEMO_ADDRESS,
        amount: String(body.amount),
        status: 'active',
        startDate: nowIso,
        endDate: body.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        successDestination: body.successDestination || SUCCESS_DESTINATION,
        failureDestination: body.failureDestination || FAILURE_DESTINATION,
        createdAt: nowIso,
        updatedAt: nowIso,
        milestones,
        activity: [createTx],
      };

      this.vaults.set(vaultId, newVault);
      this.transactions.push(createTx);

      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: newVault }),
      });
    }

    // 3. POST /vaults/:id/milestones/:mId/validate
    const validateMatch = path.match(/^\/vaults\/([^/]+)\/milestones\/([^/]+)\/validate$/);
    if (method === 'POST' && validateMatch) {
      const [, vaultId, milestoneId] = validateMatch;
      const vault = this.vaults.get(decodeURIComponent(vaultId));
      if (!vault) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Vault not found' }),
        });
      }

      const milestone = vault.milestones.find((m) => m.id === decodeURIComponent(milestoneId));
      if (!milestone) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Milestone not found' }),
        });
      }

      milestone.status = 'completed';
      const nowIso = new Date().toISOString();
      vault.updatedAt = nowIso;

      const validateTx: ApiActivity = {
        id: `tx-val-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'validate',
        vaultId: vault.id,
        amount: milestone.amount,
        status: 'confirmed',
        hash: `0xval${milestone.id.replace(/[^a-zA-Z0-9]/g, '')}000000000000000000`,
        memo: `Validated milestone: ${milestone.title}`,
        createdAt: nowIso,
      };
      this.transactions.push(validateTx);
      vault.activity = vault.activity ? [...vault.activity, validateTx] : [validateTx];

      // Check if all milestones are completed
      const allCompleted = vault.milestones.every((m) => m.status === 'completed');
      if (allCompleted) {
        vault.status = 'completed';
        const releaseTx: ApiActivity = {
          id: `tx-rel-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: 'release',
          vaultId: vault.id,
          amount: vault.amount,
          status: 'confirmed',
          hash: `0xrel${vault.id.replace(/[^a-zA-Z0-9]/g, '')}000000000000000000`,
          memo: `Funds released for vault: ${vault.name}`,
          createdAt: nowIso,
        };
        this.transactions.push(releaseTx);
        vault.activity.push(releaseTx);
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: vault }),
      });
    }

    // 4. POST /vaults/:id/fail
    const failMatch = path.match(/^\/vaults\/([^/]+)\/fail$/);
    if (method === 'POST' && failMatch) {
      const [, vaultId] = failMatch;
      const vault = this.vaults.get(decodeURIComponent(vaultId));
      if (!vault) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Vault not found' }),
        });
      }

      const nowIso = new Date().toISOString();
      vault.status = 'failed';
      vault.updatedAt = nowIso;

      const redirectTx: ApiActivity = {
        id: `tx-redir-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'redirect',
        vaultId: vault.id,
        amount: vault.amount,
        status: 'confirmed',
        hash: `0xredir${vault.id.replace(/[^a-zA-Z0-9]/g, '')}0000000000000000`,
        memo: `Funds redirected for vault: ${vault.name}`,
        createdAt: nowIso,
      };
      this.transactions.push(redirectTx);
      vault.activity = vault.activity ? [...vault.activity, redirectTx] : [redirectTx];

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: vault }),
      });
    }

    // 5. GET /vaults/:id
    const singleVaultMatch = path.match(/^\/vaults\/([^/]+)$/);
    if (method === 'GET' && singleVaultMatch) {
      const [, vaultId] = singleVaultMatch;
      const vault = this.vaults.get(decodeURIComponent(vaultId));
      if (!vault) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Vault not found' }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...vault,
            activity: this.transactions.filter((t) => t.vaultId === vault.id),
          },
        }),
      });
    }

    // 6. GET /transactions
    if (method === 'GET' && (path === '/transactions' || path === '/transactions/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: this.transactions }),
      });
    }

    // 7. GET /stats
    if (method === 'GET' && (path === '/stats' || path === '/stats/')) {
      const vaultsList = Array.from(this.vaults.values());
      const active = vaultsList.filter((v) => v.status === 'active' || v.status === 'pending_validation').length;
      const completed = vaultsList.filter((v) => v.status === 'completed').length;
      const failed = vaultsList.filter((v) => v.status === 'failed' || v.status === 'cancelled').length;
      const totalLocked = vaultsList.reduce((sum, v) => sum + Number(v.amount), 0);

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            totalVaults: vaultsList.length,
            active,
            completed,
            failed,
            totalLocked,
            totalReleased: completed * 1000,
            totalRedirected: failed * 1000,
            successRate: vaultsList.length > 0 ? Math.round((completed / vaultsList.length) * 100) : null,
          },
        }),
      });
    }

    // 8. GET /account/preferences (used by CurrencyContext)
    if (path.includes('/account/preferences')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { displayCurrency: 'USD' } }),
      });
    }

    // Fallback for any unknown /api endpoint
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  }
}

export function setupFakeApi(page: Page, initialVaults?: ApiVault[]): FakeApi {
  const fakeApi = new FakeApi(initialVaults);
  page.route('**/api/**', (route, request) => fakeApi.handleRoute(route, request));
  return fakeApi;
}
