import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import PendingValidations from '../PendingValidations';
import { useVerifierStore, type ValidationTask } from '../../Zustand/Store';
import { parsePendingQuery } from '../../utils/pendingQuery';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search}</div>;
}

const mockTasks: ValidationTask[] = [
  {
    id: 'v-1',
    vaultName: 'Alpha Fund',
    owner: '0xAAAA1111',
    amount: '10,000 USDC',
    deadline: '2026-06-15',
    status: 'pending',
    milestone: 'Phase 1',
    criteria: ['Criteria 1'],
  },
  {
    id: 'v-2',
    vaultName: 'Beta Vault',
    owner: '0xBBBB2222',
    amount: '50,000 USDC',
    deadline: '2026-05-10',
    status: 'pending',
    milestone: 'Phase 2',
    criteria: ['Criteria 2'],
  },
  {
    id: 'v-3',
    vaultName: 'Gamma Capital',
    owner: '0xCCCC3333',
    amount: '5,000 USDC',
    deadline: '2026-07-20',
    status: 'pending',
    milestone: 'Phase 1',
    criteria: ['Criteria 3'],
  },
];

function renderPage(initialEntry = '/verifier/queue') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PendingValidations />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

describe('PendingValidations URL-synced view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVerifierStore.setState({
      pendingValidations: [...mockTasks],
      validationHistory: [],
    });
  });

  it('restores exact view from URL search parameters on initial load', () => {
    renderPage(
      '/verifier/queue?q=Alpha&milestone=Phase%201&sort=amount&dir=desc',
    );

    const searchInput = screen.getByLabelText(/search by vault name or owner/i) as HTMLInputElement;
    expect(searchInput.value).toBe('Alpha');

    const milestoneSelect = screen.getByLabelText(/filter by milestone/i) as HTMLSelectElement;
    expect(milestoneSelect.value).toBe('Phase 1');

    const sortSelect = screen.getByLabelText(/sort by/i) as HTMLSelectElement;
    expect(sortSelect.value).toBe('amount');

    expect(screen.getByRole('button', { name: /sort direction: descending/i })).toBeInTheDocument();

    // Only Alpha Fund matches query 'Alpha' and milestone 'Phase 1'
    expect(screen.getByText('Alpha Fund')).toBeInTheDocument();
    expect(screen.queryByText('Beta Vault')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma Capital')).not.toBeInTheDocument();
  });

  it('falls back safely to default state when URL has invalid/unknown params', () => {
    renderPage('/verifier/queue?sort=bogus&dir=up');

    const searchInput = screen.getByLabelText(/search by vault name or owner/i) as HTMLInputElement;
    expect(searchInput.value).toBe('');

    const milestoneSelect = screen.getByLabelText(/filter by milestone/i) as HTMLSelectElement;
    expect(milestoneSelect.value).toBe('');

    const sortSelect = screen.getByLabelText(/sort by/i) as HTMLSelectElement;
    expect(sortSelect.value).toBe('deadline');

    expect(screen.getByRole('button', { name: /sort direction: ascending/i })).toBeInTheDocument();

    // All items displayed sorted by deadline asc: Beta (May 10) -> Alpha (June 15) -> Gamma (July 20)
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Beta Vault')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Alpha Fund')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Gamma Capital')).toBeInTheDocument();
  });

  it('typing in search updates the URL query string using replace', () => {
    renderPage('/verifier/queue');

    const searchInput = screen.getByLabelText(/search by vault name or owner/i);
    fireEvent.change(searchInput, { target: { value: 'Beta' } });

    expect(screen.getByTestId('location-display')).toHaveTextContent('q=Beta');
    expect(screen.getByText('Beta Vault')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Fund')).not.toBeInTheDocument();
  });

  it('changing milestone filter updates the URL query string', () => {
    renderPage('/verifier/queue');

    const milestoneSelect = screen.getByLabelText(/filter by milestone/i);
    fireEvent.change(milestoneSelect, { target: { value: 'Phase 2' } });

    expect(screen.getByTestId('location-display')).toHaveTextContent('milestone=Phase+2');
    expect(screen.getByText('Beta Vault')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Fund')).not.toBeInTheDocument();
  });

  it('changing sort dropdown updates the URL query string using push', () => {
    renderPage('/verifier/queue');

    const sortSelect = screen.getByLabelText(/sort by/i);
    fireEvent.change(sortSelect, { target: { value: 'amount' } });

    expect(screen.getByTestId('location-display')).toHaveTextContent('sort=amount');
    // amount ascending: Gamma (5,000) -> Alpha (10,000) -> Beta (50,000)
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Gamma Capital')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Alpha Fund')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Beta Vault')).toBeInTheDocument();
  });

  it('clicking sort direction button updates the URL query string', () => {
    renderPage('/verifier/queue');

    const dirButton = screen.getByRole('button', { name: /sort direction: ascending/i });
    fireEvent.click(dirButton);

    expect(screen.getByTestId('location-display')).toHaveTextContent('dir=desc');
    expect(screen.getByRole('button', { name: /sort direction: descending/i })).toBeInTheDocument();
    // deadline desc: Gamma (July 20) -> Alpha (June 15) -> Beta (May 10)
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Gamma Capital')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Alpha Fund')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Beta Vault')).toBeInTheDocument();
  });

  it('clicking sortable table headers updates sort key and toggles direction in URL', () => {
    renderPage('/verifier/queue');

    // Click "Amount at Stake" column header button
    const amountHeaderBtn = screen.getByRole('button', { name: /sort amount at stake column/i });
    fireEvent.click(amountHeaderBtn);

    expect(screen.getByTestId('location-display')).toHaveTextContent('sort=amount');

    // Click again to toggle direction to desc
    fireEvent.click(amountHeaderBtn);
    expect(screen.getByTestId('location-display')).toHaveTextContent('sort=amount&dir=desc');
  });

  it('selection resets when filters change (search or milestone)', () => {
    renderPage('/verifier/queue');

    // Select Alpha Fund
    const alphaCheckbox = screen.getByLabelText(/select alpha fund/i);
    fireEvent.click(alphaCheckbox);
    expect(alphaCheckbox).toBeChecked();
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    // Type in search -> selection must reset
    const searchInput = screen.getByLabelText(/search by vault name or owner/i);
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    expect(screen.getByText('0 selected')).toBeInTheDocument();

    // Select Alpha Fund again
    const alphaCheckboxAfterSearch = screen.getByLabelText(/select alpha fund/i);
    fireEvent.click(alphaCheckboxAfterSearch);
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    // Change milestone -> selection must reset
    const milestoneSelect = screen.getByLabelText(/filter by milestone/i);
    fireEvent.change(milestoneSelect, { target: { value: 'Phase 1' } });
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('selection does NOT reset when sort changes', () => {
    renderPage('/verifier/queue');

    // Select Beta Vault
    const betaCheckbox = screen.getByLabelText(/select beta vault/i);
    fireEvent.click(betaCheckbox);
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    // Change sort key to amount
    const sortSelect = screen.getByLabelText(/sort by/i);
    fireEvent.change(sortSelect, { target: { value: 'amount' } });

    // Selection remains 1
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('shows "All caught up!" when queue is empty', () => {
    useVerifierStore.setState({
      pendingValidations: [],
      validationHistory: [],
    });
    renderPage('/verifier/queue');

    expect(screen.getByText('All caught up!')).toBeInTheDocument();
    expect(screen.getByText(/no pending validations in your queue/i)).toBeInTheDocument();
  });

  it('shows "No results found" when filters do not match any validations', () => {
    renderPage('/verifier/queue?q=nonexistent');

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(
      screen.getByText(/no validations match your search filters/i),
    ).toBeInTheDocument();
  });

  describe('CSV export', () => {
    it('exports all visible rows in current sort order with pending-validations.csv filename', () => {
      renderPage();
      const exportButton = screen.getByRole('button', {
        name: /Export filtered pending validations as CSV/i,
      });
      expect(exportButton).not.toBeDisabled();

      fireEvent.click(exportButton);

      expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
      const [csv, filename] = mockDownloadCsv.mock.calls[0];
      expect(filename).toBe('pending-validations.csv');

      const lines = csv.split('\r\n');
      // Default sort is deadline asc: v-2 (2026-06-20), v-1 (2026-07-01), v-3 (2026-07-10)
      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe('ID,Status,Vault Name,Owner,Amount,Deadline,Milestone,Notes');
      expect(lines[1]).toContain('v-2');
      expect(lines[2]).toContain('v-1');
      expect(lines[3]).toContain('v-3');
    });

    it('exports rows in updated sort order when sort direction is toggled', () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: /Sort direction:/i }));
      fireEvent.click(
        screen.getByRole('button', { name: /Export filtered pending validations as CSV/i }),
      );

      expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
      const [csv, filename] = mockDownloadCsv.mock.calls[0];
      expect(filename).toBe('pending-validations.csv');

      const lines = csv.split('\r\n');
      // Deadline desc: v-3 (2026-07-10), v-1 (2026-07-01), v-2 (2026-06-20)
      expect(lines).toHaveLength(4);
      expect(lines[1]).toContain('v-3');
      expect(lines[2]).toContain('v-1');
      expect(lines[3]).toContain('v-2');
    });

    it('exports only currently visible filtered rows', () => {
      renderPage();
      const milestoneSelect = screen.getByLabelText(/Filter by Milestone/i) as HTMLSelectElement;
      fireEvent.change(milestoneSelect, { target: { value: 'Phase 1' } });

      fireEvent.click(
        screen.getByRole('button', { name: /Export filtered pending validations as CSV/i }),
      );

      expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
      const [csv, filename] = mockDownloadCsv.mock.calls[0];
      expect(filename).toBe('pending-validations.csv');

      const lines = csv.split('\r\n');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('v-1');
    });

    it('disables Export CSV button when search matches nothing', () => {
      renderPage();
      const searchInput = screen.getByLabelText(/Search by Vault Name or Owner/i) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'NonExistentVault' } });

      const exportButton = screen.getByRole('button', {
        name: /Export filtered pending validations as CSV/i,
      });
      expect(exportButton).toBeDisabled();

      fireEvent.click(exportButton);
      expect(mockDownloadCsv).not.toHaveBeenCalled();
    });

    it('disables Export CSV button when pending queue is empty', () => {
      mockedUseVerifierStore.mockReturnValue({ pendingValidations: [] });
      renderPage();

      const exportButton = screen.getByRole('button', {
        name: /Export filtered pending validations as CSV/i,
      });
      expect(exportButton).toBeDisabled();

      fireEvent.click(exportButton);
      expect(mockDownloadCsv).not.toHaveBeenCalled();
    });
  });
});
