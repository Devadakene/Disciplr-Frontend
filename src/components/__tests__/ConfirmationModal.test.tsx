import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmationModal } from '../../components/ConfirmationModal';


describe('ConfirmationModal', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(
    props: Partial<React.ComponentProps<typeof ConfirmationModal>> = {},
  ) {
    return render(
      <ConfirmationModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        {...props}
      />,
    );
  }

  it('does not render dialog content when closed', () => {
    render(
      <ConfirmationModal
        isOpen={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, decision controls, notes, and evidence link', () => {
    renderModal({ evidenceUrl: 'https://example.com/proof' });

    const dialog = screen.getByRole('dialog', { name: 'Confirm Validation' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Final Decision')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Approve/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Reject/i })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Verification Notes/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /View submitted proof/i })).toHaveAttribute(
      'href',
      'https://example.com/proof',
    );
  });

  it('confirms an approval with optional notes', () => {
    renderModal({ initialDecision: 'approve' });

    fireEvent.change(screen.getByLabelText(/Verification Notes/i), {
      target: { value: 'Looks ready to release.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm Approve/i }));

    expect(onConfirm).toHaveBeenCalledWith(
      'approve',
      'Looks ready to release.',
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('requires notes before confirming a rejection', () => {
    renderModal({ initialDecision: 'reject' });

    const confirm = screen.getByRole('button', { name: /Confirm Reject/i });
    expect(confirm).toBeDisabled();
    expect(screen.getByText('Notes are required for rejection.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Verification Notes/i), {
      target: { value: 'Evidence does not match the milestone criteria.' },
    });
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(
      'reject',
      'Evidence does not match the milestone criteria.',
    );
  });

  it('switches decisions and updates irreversible-action messaging', () => {
    renderModal({ initialDecision: 'approve' });

    expect(
      screen.getByText(/Approval will trigger an on-chain transaction/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));

    expect(
      screen.getByText(/Rejection will notify the vault owner/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Reason for rejection is required/i),
    ).toBeInTheDocument();
  });

  it('calls onClose from cancel, close, and Escape', () => {
    renderModal({ initialDecision: 'approve' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    fireEvent.keyDown(screen.getByTestId('focus-trap'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('resets decision and notes when reopened with new initial props', () => {
    const { rerender } = render(
      <ConfirmationModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        initialDecision="approve"
        initialNotes="Initial approval note"
      />,
    );

    expect(screen.getByLabelText(/Verification Notes/i)).toHaveValue(
      'Initial approval note',
    );

    rerender(
      <ConfirmationModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        initialDecision="reject"
        initialNotes="Needs a clearer screenshot"
      />,
    );

    expect(screen.getByLabelText(/Verification Notes/i)).toHaveValue(
      'Needs a clearer screenshot',
    );
    expect(
      screen.getByText(/Rejection will notify the vault owner/i),
    ).toBeInTheDocument();
  });

  it('locks the confirm button while a submission is in flight', () => {
    renderModal({ initialDecision: 'approve', isSubmitting: true });

    const confirm = screen.getByRole('button', { name: /Submitting/ });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close modal' })).toBeDisabled();

    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('locks simple confirmations while submitting', () => {
    renderModal({
      simpleConfirm: { title: 'Cancel vault', message: 'Irreversible.' },
      isSubmitting: true,
    });

    const confirm = screen.getByRole('button', { name: /Submitting/ });
    expect(confirm).toBeDisabled();
  });
});
