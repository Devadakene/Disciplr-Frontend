import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useVerifierStore } from '../../Zustand/Store';
import VerifierMetrics from '../VerifierMetrics';
import type { ValidationTask } from '../../Zustand/Store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTask = (
  id: string,
  status: ValidationTask['status'],
  daysUntilDeadline: number,
): ValidationTask => ({
  id,
  vaultName: `Vault ${id}`,
  owner: '0xtest',
  amount: '1,000 USDC',
  deadline: new Date(Date.UTC(2026, 6, 1 + daysUntilDeadline)).toISOString(),
  status,
  milestone: `Milestone ${id}`,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VerifierMetrics component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with controlled store data', () => {
    beforeEach(() => {
      // 2 approved, 1 rejected history → approvalRate = 66.67% → rounds to 67%
      // 1 overdue (daysRemaining=0), 1 urgent (daysRemaining=2)
      useVerifierStore.setState({
        pendingValidations: [
          makeTask('p-1', 'pending', 0),  // overdue
          makeTask('p-2', 'pending', 2),  // urgent
          makeTask('p-3', 'pending', 5),  // neither
        ],
        validationHistory: [
          makeTask('h-1', 'approved', 0),
          makeTask('h-2', 'approved', 0),
          makeTask('h-3', 'rejected', 0),
        ],
      });
    });

    it('renders all four metric cards', () => {
      render(<VerifierMetrics />);
      expect(screen.getByText('Approval Rate')).toBeInTheDocument();
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByText('Urgent')).toBeInTheDocument();
      expect(screen.getByText('Total Resolved')).toBeInTheDocument();
    });

    it('displays the correct approval rate (67%)', () => {
      render(<VerifierMetrics />);
      expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('displays the correct overdue count', () => {
      render(<VerifierMetrics />);
      // p-1 has daysRemaining=0 → overdue=1
      // Use aria-label to avoid ambiguity (urgentCount is also 1 in this dataset)
      const overdueCard = screen.getByLabelText('Overdue: 1');
      expect(overdueCard).toBeInTheDocument();
    });

    it('displays the correct urgent count', () => {
      render(<VerifierMetrics />);
      // p-2 has daysRemaining=2 → urgent=1 (p-1 overdue is mutually exclusive)
      const urgentCard = screen.getByLabelText('Urgent: 1');
      expect(urgentCard).toBeInTheDocument();
    });

    it('displays the correct total resolved count', () => {
      render(<VerifierMetrics />);
      const resolvedCard = screen.getByLabelText('Total resolved: 3');
      expect(resolvedCard).toBeInTheDocument();
    });

    it('has correct aria-label on approval rate card', () => {
      render(<VerifierMetrics />);
      // 2/3 * 100 = 66.67 → Math.round = 67
      expect(screen.getByLabelText('Approval rate: 67 percent')).toBeInTheDocument();
    });
  });

  describe('with empty history (zero-division guard)', () => {
    beforeEach(() => {
      useVerifierStore.setState({
        pendingValidations: [],
        validationHistory: [],
      });
    });

    it('renders without crashing when history is empty', () => {
      expect(() => render(<VerifierMetrics />)).not.toThrow();
    });

    it('shows 0% approval rate — not NaN', () => {
      render(<VerifierMetrics />);
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
    });

    it('shows zero for all counts when both arrays are empty', () => {
      render(<VerifierMetrics />);
      expect(screen.getByLabelText('Approval rate: 0 percent')).toBeInTheDocument();
      expect(screen.getByLabelText('Overdue: 0')).toBeInTheDocument();
      expect(screen.getByLabelText('Urgent: 0')).toBeInTheDocument();
      expect(screen.getByLabelText('Total resolved: 0')).toBeInTheDocument();
    });
  });

  describe('with all-approved history', () => {
    beforeEach(() => {
      useVerifierStore.setState({
        pendingValidations: [],
        validationHistory: [
          makeTask('h-1', 'approved', 0),
          makeTask('h-2', 'approved', 0),
        ],
      });
    });

    it('shows 100% approval rate', () => {
      render(<VerifierMetrics />);
      expect(screen.getByLabelText('Approval rate: 100 percent')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
