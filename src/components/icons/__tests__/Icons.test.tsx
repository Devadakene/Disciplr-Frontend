import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VaultIcon } from '../VaultIcon';
import { MilestoneIcon } from '../MilestoneIcon';
import { TimeLockIcon } from '../TimeLockIcon';
import { TreasuryIcon } from '../TreasuryIcon';
import * as Icons from '../index';

describe('Disciplr custom icons', () => {
  const iconCases = [
    { name: 'VaultIcon', Component: VaultIcon },
    { name: 'MilestoneIcon', Component: MilestoneIcon },
    { name: 'TimeLockIcon', Component: TimeLockIcon },
    { name: 'TreasuryIcon', Component: TreasuryIcon },
  ] as const;

  it.each(iconCases)('$name renders an SVG element', ({ Component }) => {
    render(<Component data-testid="icon" />);
    const svg = screen.getByTestId('icon');
    expect(svg.tagName).toBe('svg');
  });

  it.each(iconCases)('$name defaults to 24×24', ({ Component }) => {
    render(<Component data-testid="icon" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it.each(iconCases)('$name supports custom size', ({ Component }) => {
    render(<Component size={32} data-testid="icon" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it.each(iconCases)('$name supports className', ({ Component }) => {
    render(<Component className="test-class" data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveClass('test-class');
  });

  it.each(iconCases)('$name has aria-hidden="true"', ({ Component }) => {
    render(<Component data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each(iconCases)('$name uses currentColor stroke', ({ Component }) => {
    render(<Component data-testid="icon" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });

  it.each(iconCases)('$name uses stroke-based rendering (no fill)', ({ Component }) => {
    render(<Component data-testid="icon" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveAttribute('fill', 'none');
  });

  it.each(iconCases)('$name has a 24×24 viewBox', ({ Component }) => {
    render(<Component data-testid="icon" />);
    expect(screen.getByTestId('icon')).toHaveAttribute('viewBox', '0 0 24 24');
  });
});

describe('Icon barrel exports', () => {
  it('exports VaultIcon', () => {
    expect(Icons.VaultIcon).toBeDefined();
  });

  it('exports MilestoneIcon', () => {
    expect(Icons.MilestoneIcon).toBeDefined();
  });

  it('exports TimeLockIcon', () => {
    expect(Icons.TimeLockIcon).toBeDefined();
  });

  it('exports TreasuryIcon', () => {
    expect(Icons.TreasuryIcon).toBeDefined();
  });
});
