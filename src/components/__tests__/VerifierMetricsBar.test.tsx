import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VerifierMetricsBar } from '../VerifierMetricsBar';
import type { VerifierMetrics } from '../../utils/verifierMetrics';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ZERO_METRICS: VerifierMetrics = {
  pendingCount: 0,
  overdueCount: 0,
  criticalCount: 0,
  approvalRate: 0,
  urgentCount: 0,
  totalResolved: 0,
};

const CRITICAL_METRICS: VerifierMetrics = {
  pendingCount: 8,
  overdueCount: 2,
  criticalCount: 3,
  approvalRate: 2 / 3, // 66.67% -> rounds to 67%
  urgentCount: 3,
  totalResolved: 3,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VerifierMetricsBar component', () => {
  describe('with a zero queue', () => {
    it('renders the metrics bar landmark and all four metric groups', () => {
      render(<VerifierMetricsBar metrics={ZERO_METRICS} />);

      expect(
        screen.getByRole('region', { name: 'Verifier queue metrics' }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('verifier-metrics-bar')).toBeInTheDocument();

      expect(screen.getByRole('group', { name: 'Pending' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Overdue' })).toBeInTheDocument();
      expect(
        screen.getByRole('group', { name: 'Critical (≤3d)' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('group', { name: 'Approval rate' }),
      ).toBeInTheDocument();
    });

    it('renders zeros for all counts and 0% with empty-history description', () => {
      render(<VerifierMetricsBar metrics={ZERO_METRICS} />);

      const pendingGroup = screen.getByRole('group', { name: 'Pending' });
      expect(within(pendingGroup).getByText('0')).toBeInTheDocument();

      const overdueGroup = screen.getByRole('group', { name: 'Overdue' });
      expect(within(overdueGroup).getByText('0')).toBeInTheDocument();

      const criticalGroup = screen.getByRole('group', { name: 'Critical (≤3d)' });
      expect(within(criticalGroup).getByText('0')).toBeInTheDocument();

      const approvalGroup = screen.getByRole('group', { name: 'Approval rate' });
      expect(within(approvalGroup).getByText('0%')).toBeInTheDocument();
      expect(within(approvalGroup).getByText('No history yet')).toBeInTheDocument();
    });

    it('renders no critical or overdue alert styling when counts are zero', () => {
      render(<VerifierMetricsBar metrics={ZERO_METRICS} />);

      const criticalGroup = screen.getByRole('group', { name: 'Critical (≤3d)' });
      const criticalValue = within(criticalGroup).getByText('0');
      expect(criticalValue).toHaveStyle({ color: 'var(--success)' });
      expect(criticalValue).not.toHaveStyle({ color: 'var(--warning)' });
      expect(
        within(criticalGroup).getByText('No urgent deadlines'),
      ).toBeInTheDocument();

      const overdueGroup = screen.getByRole('group', { name: 'Overdue' });
      const overdueValue = within(overdueGroup).getByText('0');
      expect(overdueValue).toHaveStyle({ color: 'var(--success)' });
      expect(overdueValue).not.toHaveStyle({ color: 'var(--danger)' });
    });
  });

  describe('with non-zero critical and overdue counts', () => {
    it('displays the critical count and exposes it to assistive tech with warning styling', () => {
      render(<VerifierMetricsBar metrics={CRITICAL_METRICS} />);

      const criticalGroup = screen.getByRole('group', { name: 'Critical (≤3d)' });
      const criticalValue = within(criticalGroup).getByText('3');
      expect(criticalValue).toBeInTheDocument();
      expect(criticalValue).toHaveStyle({ color: 'var(--warning)' });
      expect(
        within(criticalGroup).getByText('≤ 3 days to deadline'),
      ).toBeInTheDocument();
    });

    it('displays pending, overdue, and rounded approval rate values with expected tones', () => {
      render(<VerifierMetricsBar metrics={CRITICAL_METRICS} />);

      const pendingGroup = screen.getByRole('group', { name: 'Pending' });
      const pendingValue = within(pendingGroup).getByText('8');
      expect(pendingValue).toHaveStyle({ color: 'var(--text)' });

      const overdueGroup = screen.getByRole('group', { name: 'Overdue' });
      const overdueValue = within(overdueGroup).getByText('2');
      expect(overdueValue).toHaveStyle({ color: 'var(--danger)' });

      const approvalGroup = screen.getByRole('group', { name: 'Approval rate' });
      const approvalValue = within(approvalGroup).getByText('67%');
      expect(approvalValue).toHaveStyle({ color: 'var(--text)' });
      expect(
        within(approvalGroup).queryByText('No history yet'),
      ).not.toBeInTheDocument();
    });
  });

  describe('approval rate formatting and tone thresholds', () => {
    it('uses success tone for approval rates >= 75%', () => {
      render(
        <VerifierMetricsBar
          metrics={{ ...ZERO_METRICS, pendingCount: 1, approvalRate: 0.8 }}
        />,
      );

      const approvalGroup = screen.getByRole('group', { name: 'Approval rate' });
      const approvalValue = within(approvalGroup).getByText('80%');
      expect(approvalValue).toHaveStyle({ color: 'var(--success)' });
    });

    it('uses warning tone for approval rates < 50%', () => {
      render(
        <VerifierMetricsBar
          metrics={{ ...ZERO_METRICS, pendingCount: 1, approvalRate: 0.25 }}
        />,
      );

      const approvalGroup = screen.getByRole('group', { name: 'Approval rate' });
      const approvalValue = within(approvalGroup).getByText('25%');
      expect(approvalValue).toHaveStyle({ color: 'var(--warning)' });
    });
  });
});
