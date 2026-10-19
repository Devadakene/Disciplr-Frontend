import React from 'react';
import { useVerifierStore } from '../Zustand/Store';
import { computeVerifierMetrics } from '../utils/verifierMetrics';
import { useCurrentTime } from '../hooks/useCurrentTime';

// Color tokens are global CSS variables (no import needed) — same pattern as
// StatusChip.tsx and VerifierDashboard.tsx in this codebase.

interface MetricCardProps {
  label: string;
  value: string;
  accentColor: string;
  ariaLabel: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, accentColor, ariaLabel }) => (
  <div
    aria-label={ariaLabel}
    style={{
      background: 'var(--bg)',
      border: `1px solid var(--border)`,
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 'var(--radius-md)',
      padding: '1.25rem 1.5rem',
      boxShadow: 'var(--shadow-level-1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
    }}
  >
    <p
      style={{
        margin: 0,
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--muted)',
      }}
    >
      {label}
    </p>
    <p
      style={{
        margin: 0,
        fontSize: '2rem',
        fontWeight: 700,
        color: 'var(--text)',
        lineHeight: 1.1,
      }}
    >
      {value}
    </p>
  </div>
);

const VerifierMetrics: React.FC = () => {
  const pendingValidations = useVerifierStore((state) => state.pendingValidations);
  const validationHistory = useVerifierStore((state) => state.validationHistory);
  const now = useCurrentTime();

  const { approvalRate, overdueCount, urgentCount, totalResolved } =
    computeVerifierMetrics(pendingValidations, validationHistory, now);

  const approvalDisplay = `${Math.round(approvalRate * 100)}%`;

  return (
    <section
      aria-label="Verifier performance metrics"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <MetricCard
        label="Approval Rate"
        value={approvalDisplay}
        accentColor="var(--success)"
        ariaLabel={`Approval rate: ${Math.round(approvalRate * 100)} percent`}
      />
      <MetricCard
        label="Overdue"
        value={String(overdueCount)}
        accentColor="var(--danger)"
        ariaLabel={`Overdue: ${overdueCount}`}
      />
      <MetricCard
        label="Urgent"
        value={String(urgentCount)}
        accentColor="var(--warning)"
        ariaLabel={`Urgent: ${urgentCount}`}
      />
      <MetricCard
        label="Total Resolved"
        value={String(totalResolved)}
        accentColor="var(--accent)"
        ariaLabel={`Total resolved: ${totalResolved}`}
      />
    </section>
  );
};

export default VerifierMetrics;
