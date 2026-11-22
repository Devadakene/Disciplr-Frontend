import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  LocaleProvider,
  useLocale,
  useT,
  en,
  es,
  LOCALE_STORAGE_KEY,
  resetMissingKeyWarnings,
  type PartialMessageCatalog,
  type Locale,
} from '../index';
import LanguageSelector from '../../components/LanguageSelector';
import Home from '../../pages/Home';
import { formatUsdc, setFormatLocale, setTestLocale } from '../../utils/format';

vi.mock('../../context/WalletContext', () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWallet: () => ({
    address: null,
    network: null,
    balance: null,
    isConnecting: false,
    error: null,
    connect: async () => {},
    connectDemo: () => {},
    disconnect: () => {},
    checkConnection: async () => {},
  }),
}));

vi.mock('../../components/Wallet/WalletConnectButton', () => ({
  WalletConnectButton: () => <button type="button">Connect Wallet</button>,
  default: () => <button type="button">Connect Wallet</button>,
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'en';
  setTestLocale(null);
  setFormatLocale(null);
  resetMissingKeyWarnings();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('i18n — LocaleProvider, useT, and LanguageSelector', () => {
  test('switching to the second locale changes the Home heading text and updates document.documentElement.lang', () => {
    render(
      <LocaleProvider>
        <MemoryRouter>
          <LanguageSelector />
          <Home />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(document.documentElement.lang).toBe('en');
    expect(
      screen.getByRole('heading', { level: 1, name: en['home.hero.title'] }),
    ).toBeInTheDocument();

    const selector = screen.getByRole('combobox', { name: 'Language' });
    fireEvent.change(selector, { target: { value: 'es' } });

    expect(document.documentElement.lang).toBe('es');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: es['home.hero.title'] as string,
      }),
    ).toBeInTheDocument();
  });

  test('a missing key in a non-English locale renders the English fallback and calls console.warn once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const partialEs: PartialMessageCatalog = { ...es };
    delete partialEs['home.hero.title'];
    const catalogs: Record<Locale, PartialMessageCatalog> = {
      en,
      es: partialEs,
    };

    function MissingKeyProbe() {
      const t = useT();
      return (
        <div>
          <span data-testid="first">{t('home.hero.title')}</span>
          <span data-testid="second">{t('home.hero.title')}</span>
        </div>
      );
    }

    render(
      <LocaleProvider initialLocale="es" catalogs={catalogs}>
        <MissingKeyProbe />
      </LocaleProvider>,
    );

    expect(screen.getByTestId('first')).toHaveTextContent(en['home.hero.title']);
    expect(screen.getByTestId('second')).toHaveTextContent(en['home.hero.title']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('home.hero.title');
  });

  test('formatUsdc(1234.5) output changes with locale', () => {
    function LocaleSwitcher() {
      const { locale, setLocale } = useLocale();
      return (
        <div>
          <span data-testid="amount">{formatUsdc(1234.5)}</span>
          <span data-testid="locale">{locale}</span>
          <button type="button" onClick={() => setLocale('es')}>
            Switch to ES
          </button>
        </div>
      );
    }

    render(
      <LocaleProvider initialLocale="en">
        <LocaleSwitcher />
      </LocaleProvider>,
    );

    const enOutput = screen.getByTestId('amount').textContent;
    expect(enOutput).toBe('1,234.50');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to ES' }));

    const esOutput = screen.getByTestId('amount').textContent;
    expect(esOutput).not.toBe(enOutput);
    expect(esOutput).toContain(',50');
  });

  test('supports {count} interpolation and pluralization', () => {
    function PluralProbe() {
      const t = useT();
      return (
        <div>
          <span data-testid="at-risk">
            {t('dashboard.atRisk.title', { count: 3 })}
          </span>
          <span data-testid="one">
            {t('dashboard.yourVaults.unverifiedCount', { count: 1 })}
          </span>
          <span data-testid="many">
            {t('dashboard.yourVaults.unverifiedCount', { count: 4 })}
          </span>
        </div>
      );
    }

    render(
      <LocaleProvider initialLocale="en">
        <PluralProbe />
      </LocaleProvider>,
    );

    expect(screen.getByTestId('at-risk')).toHaveTextContent('⚠️ At Risk (3)');
    expect(screen.getByTestId('one')).toHaveTextContent(
      '1 vault could not be verified and is not shown.',
    );
    expect(screen.getByTestId('many')).toHaveTextContent(
      '4 vaults could not be verified and are not shown.',
    );
  });

  test('handles localStorage errors gracefully without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    render(
      <LocaleProvider>
        <LanguageSelector />
      </LocaleProvider>,
    );

    const selector = screen.getByRole('combobox');
    expect(() =>
      fireEvent.change(selector, { target: { value: 'es' } }),
    ).not.toThrow();
    expect(document.documentElement.lang).toBe('es');
  });
});
