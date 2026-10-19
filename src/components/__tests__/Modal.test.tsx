import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Modal } from '../Modal';
import { useReducedMotion } from 'framer-motion';

vi.mock('framer-motion', async (importOriginal) => {
  const original = await importOriginal<typeof import('framer-motion')>();
  return {
    ...original,
    useReducedMotion: vi.fn(),
  };
});

describe('Modal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when open', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div data-testid="modal-content">Hello Content</div>
      </Modal>
    );

    expect(screen.getByTestId('modal-content')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('does not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={onClose}>
        <div data-testid="modal-content">Hello Content</div>
      </Modal>
    );

    expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when clicking the backdrop overlay', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div data-testid="modal-content">Hello Content</div>
      </Modal>
    );

    // Click the backdrop overlay (parent of the dialog content)
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking the content area', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <button data-testid="modal-content">Hello Content</button>
      </Modal>
    );

    const content = screen.getByTestId('modal-content');
    fireEvent.click(content);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key press (through focus trap deactivation)', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div data-testid="modal-content">Hello Content</div>
      </Modal>
    );

    // Escape event on focus trap triggers onDeactivate -> onClose
    const focusTrap = screen.getByTestId('focus-trap');
    fireEvent.keyDown(focusTrap, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports custom overlay and content class names', () => {
    render(
      <Modal
        isOpen={true}
        onClose={onClose}
        overlayClassName="custom-overlay-class"
        contentClassName="custom-content-class"
      >
        <div>Hello Content</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('custom-content-class');

    const overlay = dialog.parentElement!;
    expect(overlay).toHaveClass('custom-overlay-class');
  });

  it('respects reduced-motion preference', () => {
    const useReducedMotionMock = vi.mocked(useReducedMotion);
    useReducedMotionMock.mockReturnValue(true);

    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Hello Content</div>
      </Modal>
    );

    // Reduced motion is active, verifying it renders fine
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
