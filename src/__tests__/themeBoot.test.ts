import { describe, test, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import themeBootScript from '../../public/theme-boot.js?raw';

describe('theme-boot.js', () => {
  function runBootScript(options: {
    storedTheme?: string | null;
    throwStorage?: boolean;
    osDarkMode?: boolean;
    missingMatchMedia?: boolean;
  }) {
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      runScripts: 'dangerously',
      url: 'https://example.com',
    });

    const { window } = dom;

    if (options.throwStorage) {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('Storage disabled');
        },
        configurable: true,
      });
    } else if (options.storedTheme !== undefined && options.storedTheme !== null) {
      window.localStorage.setItem('disciplr-theme', options.storedTheme);
    }

    if (options.missingMatchMedia) {
      // @ts-expect-error delete matchMedia
      delete window.matchMedia;
    } else {
      window.matchMedia = ((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)' ? Boolean(options.osDarkMode) : false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    }

    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = themeBootScript;
    window.document.head.appendChild(scriptEl);

    return {
      dataTheme: window.document.documentElement.getAttribute('data-theme'),
      colorScheme: window.document.documentElement.style.colorScheme,
    };
  }

  test('applies stored "dark" theme regardless of OS mode', () => {
    const resLightOS = runBootScript({ storedTheme: 'dark', osDarkMode: false });
    expect(resLightOS.dataTheme).toBe('dark');
    expect(resLightOS.colorScheme).toBe('dark');

    const resDarkOS = runBootScript({ storedTheme: 'dark', osDarkMode: true });
    expect(resDarkOS.dataTheme).toBe('dark');
    expect(resDarkOS.colorScheme).toBe('dark');
  });

  test('applies stored "light" theme when OS is dark mode (acceptance criterion)', () => {
    const res = runBootScript({ storedTheme: 'light', osDarkMode: true });
    expect(res.dataTheme).toBe('light');
    expect(res.colorScheme).toBe('light');
  });

  test('falls back to OS dark mode when stored is "system"', () => {
    const res = runBootScript({ storedTheme: 'system', osDarkMode: true });
    expect(res.dataTheme).toBe('dark');
    expect(res.colorScheme).toBe('dark');
  });

  test('falls back to OS light mode when stored is "system"', () => {
    const res = runBootScript({ storedTheme: 'system', osDarkMode: false });
    expect(res.dataTheme).toBe('light');
    expect(res.colorScheme).toBe('light');
  });

  test('falls back to OS mode when no stored theme is present', () => {
    const resDark = runBootScript({ osDarkMode: true });
    expect(resDark.dataTheme).toBe('dark');
    expect(resDark.colorScheme).toBe('dark');

    const resLight = runBootScript({ osDarkMode: false });
    expect(resLight.dataTheme).toBe('light');
    expect(resLight.colorScheme).toBe('light');
  });

  test('falls back to OS preference when stored value is invalid', () => {
    const res = runBootScript({ storedTheme: 'invalid-val', osDarkMode: true });
    expect(res.dataTheme).toBe('dark');
    expect(res.colorScheme).toBe('dark');
  });

  test('handles throwing localStorage and falls back to OS preference', () => {
    const res = runBootScript({ throwStorage: true, osDarkMode: true });
    expect(res.dataTheme).toBe('dark');
    expect(res.colorScheme).toBe('dark');
  });

  test('handles missing matchMedia gracefully and defaults to light', () => {
    const res = runBootScript({ missingMatchMedia: true });
    expect(res.dataTheme).toBe('light');
    expect(res.colorScheme).toBe('light');
  });
});
