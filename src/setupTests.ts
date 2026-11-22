import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

vi.mock('focus-trap-react', () => {
  function FocusTrapMock({
    children,
    focusTrapOptions,
  }: {
    children: React.ReactNode;
    focusTrapOptions?: {
      onDeactivate?: () => void;
      initialFocus?: string | HTMLElement | (() => HTMLElement);
    };
  }) {
    React.useEffect(() => {
      if (focusTrapOptions?.initialFocus) {
        let el: HTMLElement | null = null;
        if (typeof focusTrapOptions.initialFocus === 'string') {
          el = document.querySelector(focusTrapOptions.initialFocus);
        } else if (typeof focusTrapOptions.initialFocus === 'function') {
          el = focusTrapOptions.initialFocus();
        } else {
          el = focusTrapOptions.initialFocus;
        }
        el?.focus();
      }
    }, [focusTrapOptions]);

    return React.createElement(
      'div',
      {
        'data-testid': 'focus-trap',
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === 'Escape') {
            focusTrapOptions?.onDeactivate?.();
          }
        },
      },
      children
    );
  }

  return { default: FocusTrapMock };
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
