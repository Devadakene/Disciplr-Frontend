import { test, expect, connectDemoAccount, DEMO_ADDRESS } from './fixtures/test';
import {
  type ApiVault,
  SUCCESS_DESTINATION,
  FAILURE_DESTINATION,
} from './fixtures/fakeApi';

test.describe('Disciplr End-to-End Journeys', () => {
  test('Journey 1: Landing → "Try the demo account" → Dashboard shows data', async ({
    page,
  }) => {
    await page.goto('/');

    // Landing page displays main heading and demo account CTA
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /Secure Time‑Locked Capital Vaults on Stellar/i,
      }),
    ).toBeVisible();

    const demoButton = page.getByRole('button', {
      name: /try the demo account/i,
    });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Redirected to Dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('heading', { level: 1, name: /dashboard/i }),
    ).toBeVisible();

    // Dashboard shows summary cards and seeded active vault from mocked API
    await expect(page.getByText(/Total Locked/i)).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Active Vaults' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Seed Active Vault/i }),
    ).toBeVisible();
  });

  test('Journey 2: Create a vault with 2 milestones → redirected to its detail page with the correct amount and milestones', async ({
    page,
  }) => {
    await connectDemoAccount(page);

    // Navigate to create vault page
    await page.getByRole('link', { name: /\+ Create Vault|Create Vault/i }).first().click();
    await expect(page).toHaveURL(/\/vaults\/create/);
    await expect(
      page.getByRole('heading', { level: 1, name: /create vault/i }),
    ).toBeVisible();

    // Fill in Amount
    await page.getByLabel(/amount \(usdc\)/i).fill('1000');

    // Choose 30 days preset deadline
    await page.getByRole('button', { name: '30 days' }).click();

    // Fill valid checksummed destination addresses
    await page.getByLabel(/success destination/i).fill(SUCCESS_DESTINATION);
    await page.getByLabel(/failure destination/i).fill(FAILURE_DESTINATION);

    // Fill Milestone 1
    await page.getByLabel(/milestone 1 title/i).fill('Architecture and Design Approval');
    await page.getByLabel(/milestone 1 criteria/i).fill('Approved specifications signed by verifier');

    // Add Milestone 2
    await page.getByRole('button', { name: /add milestone/i }).click();
    await page.getByLabel(/milestone 2 title/i).fill('Smart Contract Deployment');
    await page.getByLabel(/milestone 2 criteria/i).fill('Mainnet contract verified on-chain');

    // Submit to Review
    await page.getByRole('button', { name: /^create vault$/i }).click();

    // Review screen displays details
    await expect(
      page.getByRole('heading', { level: 2, name: /review vault details/i }),
    ).toBeVisible();
    await expect(page.getByText('Architecture and Design Approval')).toBeVisible();
    await expect(page.getByText('Smart Contract Deployment')).toBeVisible();

    // Confirm creation
    await page.getByRole('button', { name: /confirm vault/i }).click();

    // Redirected to detail page
    await expect(page).toHaveURL(/\/vaults\/v-/);
    await expect(
      page.getByRole('heading', { level: 1, name: /Vault 1000 USDC/i }),
    ).toBeVisible();

    // Verify amount and both milestones on detail page
    await expect(page.getByText('1,000 USDC').first()).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: 'Architecture and Design Approval' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: 'Smart Contract Deployment' }),
    ).toBeVisible();
  });

  test('Journey 3: Verifier wallet validates both milestones → status Completed and release event in Transactions', async ({
    page,
    fakeApi,
  }) => {
    const vaultId = 'journey3-validate-vault';
    const journeyVault: ApiVault = {
      id: vaultId,
      name: 'Milestone Completion Vault',
      creator: DEMO_ADDRESS,
      verifier: DEMO_ADDRESS,
      amount: '5000',
      status: 'active',
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      successDestination: SUCCESS_DESTINATION,
      failureDestination: FAILURE_DESTINATION,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      milestones: [
        {
          id: 'm-journey3-1',
          title: 'Milestone Phase 1',
          amount: '2500',
          dueDate: '2026-11-15T00:00:00.000Z',
          status: 'pending',
        },
        {
          id: 'm-journey3-2',
          title: 'Milestone Phase 2',
          amount: '2500',
          dueDate: '2026-12-31T00:00:00.000Z',
          status: 'pending',
        },
      ],
      activity: [
        {
          id: 'tx-j3-create',
          type: 'create',
          vaultId,
          amount: '5000',
          status: 'confirmed',
          hash: '0xseedcreate00000000000000000000000000000003',
          memo: 'Vault created',
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    };
    fakeApi.seedVault(journeyVault);

    await connectDemoAccount(page);

    // Navigate to the vault
    await page.goto(`/vaults/${vaultId}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Milestone Completion Vault' }),
    ).toBeVisible();

    // Validate Milestone 1
    await page.getByRole('button', { name: /^validate milestone$/i }).click();
    const modal1 = page.getByRole('dialog');
    await expect(modal1).toBeVisible();
    await modal1.getByRole('button', { name: 'Validate' }).click();
    await expect(modal1).not.toBeVisible();

    // Validate Milestone 2
    await page.getByRole('button', { name: /^validate milestone$/i }).click();
    const modal2 = page.getByRole('dialog');
    await expect(modal2).toBeVisible();
    await modal2.getByRole('button', { name: 'Validate' }).click();
    await expect(modal2).not.toBeVisible();

    // Status is now Completed
    await expect(page.getByLabel('Completed').first()).toBeVisible();

    // Navigate to Transactions page
    await page.getByRole('link', { name: /transactions/i }).first().click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(
      page.getByRole('heading', { level: 1, name: /transactions/i }),
    ).toBeVisible();

    // Verify release event in Transactions table
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Funds released' })).toBeVisible();
    await expect(table.getByRole('row', { name: /Funds released/i })).toContainText('Milestone Completion Vault');
  });

  test('Journey 4: Cancel flow → Failed and redirect event in Transactions', async ({
    page,
    fakeApi,
  }) => {
    const vaultId = 'journey4-cancel-vault';
    const cancelVault: ApiVault = {
      id: vaultId,
      name: 'Cancellation Target Vault',
      creator: DEMO_ADDRESS,
      verifier: DEMO_ADDRESS,
      amount: '3500',
      status: 'active',
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      successDestination: SUCCESS_DESTINATION,
      failureDestination: FAILURE_DESTINATION,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      milestones: [
        {
          id: 'm-j4-1',
          title: 'Unfinished Milestone',
          amount: '3500',
          dueDate: '2026-11-30T00:00:00.000Z',
          status: 'pending',
        },
      ],
      activity: [
        {
          id: 'tx-j4-create',
          type: 'create',
          vaultId,
          amount: '3500',
          status: 'confirmed',
          hash: '0xseedcreate00000000000000000000000000000004',
          memo: 'Vault created',
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    };
    fakeApi.seedVault(cancelVault);

    await connectDemoAccount(page);

    // Navigate to vault detail
    await page.goto(`/vaults/${vaultId}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Cancellation Target Vault' }),
    ).toBeVisible();

    // Click Cancel Vault
    await page.getByRole('button', { name: /^cancel vault$/i }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Cancel Vault' }).click();
    await expect(modal).not.toBeVisible();

    // Vault status transitions to Failed
    await expect(page.getByLabel('Failed').first()).toBeVisible();

    // Navigate to Transactions page
    await page.getByRole('link', { name: /transactions/i }).first().click();
    await expect(page).toHaveURL(/\/transactions/);

    // Verify redirect event in Transactions table
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Funds redirected' })).toBeVisible();
    await expect(table.getByRole('row', { name: /Funds redirected/i })).toContainText('Cancellation Target Vault');
  });

  test('Journey 5: Deep link to a non-existent vault → not-found view', async ({
    page,
  }) => {
    await connectDemoAccount(page);

    // Deep link directly to a non-existent vault id
    await page.goto('/vaults/nonexistent-vault-999');

    // Not-found view is displayed
    await expect(
      page.getByRole('heading', { level: 2, name: /vault not found/i }),
    ).toBeVisible();
    await expect(
      page.getByText('No vault with ID "nonexistent-vault-999" exists.'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /← Back to Vaults/i }),
    ).toBeVisible();
  });

  test('Freighter: extension messaging stubbed to show the "Freighter not installed" path', async ({
    page,
  }) => {
    // Stub extension messaging to immediately signal Freighter extension is not installed
    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data?.source === 'FREIGHTER_EXTERNAL_MSG_REQUEST') {
          window.postMessage(
            {
              source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
              messageId: event.data.messageId,
              messagedId: event.data.messageId,
              apiError: 'Freighter is not installed',
              error: 'Freighter is not installed',
            },
            '*',
          );
        }
      });
    });

    await page.goto('/');

    // Open wallet connect modal
    const connectButton = page.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // Modal is open
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(
      modal.getByRole('heading', { level: 2, name: /connect wallet/i }),
    ).toBeVisible();

    // Click Freighter option
    const freighterOption = modal.getByRole('button', { name: /freighter/i });
    await expect(freighterOption).toBeVisible();
    await freighterOption.click();

    // Header button displays "Connection Failed"
    const failedButton = page.getByRole('button', { name: /connection failed/i }).first();
    await expect(failedButton).toBeVisible();

    // Clicking "Connection Failed" displays the error inside the modal
    await failedButton.click();
    await expect(page.getByText(/Freighter is not installed/i)).toBeVisible();
  });
});
