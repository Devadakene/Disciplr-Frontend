import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReducedMotion } from 'framer-motion';
import { ShortcutsHelp } from '../ShortcutsHelp';
import { SHORTCUTS } from '@/utils/shortcuts';

vi.mock('framer-motion', async (importOriginal) => {
  const original = await importOriginal<typeof import('framer-motion')>();
  return {
    ...original,
    // Bypass exit animations so DOM removal is synchronous in tests.
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: vi.fn(),
  };
});

describe('ShortcutsHelp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('renders no dialog initially', () => {
    render(<ShortcutsHelp />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the overlay on ? keydown', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the "Keyboard Shortcuts" heading when open', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByRole('heading', { name: /keyboard shortcuts/i })).toBeInTheDocument();
  });

  it('suppresses ? while an input is focused', () => {
    render(
      <>
        <input data-testid="text-field" />
        <ShortcutsHelp />
      </>,
    );
    screen.getByTestId('text-field').focus();
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('suppresses ? while a textarea is focused', () => {
    render(
      <>
        <textarea data-testid="text-area" />
        <ShortcutsHelp />
      </>,
    );
    screen.getByTestId('text-area').focus();
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('suppresses ? while a select is focused', () => {
    render(
      <>
        <select data-testid="select-field">
          <option>A</option>
        </select>
        <ShortcutsHelp />
      </>,
    );
    screen.getByTestId('select-field').focus();
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('suppresses ? while a contenteditable element is focused', () => {
    render(
      <>
        <div data-testid="editable" contentEditable suppressContentEditableWarning />
        <ShortcutsHelp />
      </>,
    );
    // Fire on the element so e.target is the contenteditable div — jsdom doesn't
    // reliably update document.activeElement for non-native-interactive elements.
    fireEvent.keyDown(screen.getByTestId('editable'), { key: '?' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores keys other than ?', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: 'k' });
    fireEvent.keyDown(document, { key: '/' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape via focus trap deactivation', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('focus-trap'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the close button is clicked', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });
    fireEvent.click(screen.getByRole('button', { name: /close keyboard shortcuts/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the backdrop overlay is clicked', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });
    // Modal stops propagation on clicks inside the dialog content itself, so
    // the backdrop (the dialog's containing overlay element) must be
    // targeted directly to trigger the close-on-outside-click behavior.
    const backdrop = screen.getByRole('dialog').parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles closed when ? is pressed again while open', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: '?' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mounts a focus trap when open', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByTestId('focus-trap')).toBeInTheDocument();
  });

  it('has aria-modal, aria-labelledby, and aria-describedby when open', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });

  it('aria-labelledby points to the heading', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });

    const dialog = screen.getByRole('dialog');
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledById!)).toHaveTextContent(/keyboard shortcuts/i);
  });

  it('renders a row for every shortcut in the registry', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });

    SHORTCUTS.forEach(({ key, description }) => {
      expect(screen.getByText(key)).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();
    });
  });

  it('renders the command palette shortcut entry', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });

    expect(screen.getByText('Ctrl/⌘ K')).toBeInTheDocument();
    expect(screen.getByText('Open the command palette')).toBeInTheDocument();
  });

  it('shows an empty-state message when the shortcuts list is empty', () => {
    render(<ShortcutsHelp shortcuts={[]} />);
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByText(/no shortcuts registered/i)).toBeInTheDocument();
  });

  it('renders shortcuts injected via props', () => {
    const custom = [{ key: 'g', description: 'Go to home' }];
    render(<ShortcutsHelp shortcuts={custom} />);
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByText('g')).toBeInTheDocument();
    expect(screen.getByText('Go to home')).toBeInTheDocument();
  });

  it('respects prefers-reduced-motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<ShortcutsHelp />);
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('removes the keydown listener on unmount', () => {
    const { unmount } = render(<ShortcutsHelp />);
    unmount();
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
