import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setFormatLocale } from '../utils/format';
import { CATALOGS, translate } from './translate';
import {
  SUPPORTED_LOCALES,
  type Locale,
  type MessageKey,
  type PartialMessageCatalog,
  type TranslationParams,
} from './types';

export const LOCALE_STORAGE_KEY = 'disciplr-locale';

// In-memory fallback when localStorage is unavailable or throws.
let memoryLocale: Locale | null = null;

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

function safeGetStoredLocale(): Locale | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isSupportedLocale(stored)) return stored;
    }
  } catch {
    // Fall back to in-memory preference when storage is unavailable.
    return memoryLocale;
  }
  return memoryLocale;
}

function safeSetStoredLocale(locale: Locale): void {
  memoryLocale = locale;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  } catch {
    // Storage unavailable (e.g. private mode / quota); keep in-memory fallback.
  }
}

export type TranslateFn = (
  key: MessageKey,
  params?: TranslationParams,
) => string;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
}

const defaultTranslate: TranslateFn = (key, params) =>
  translate('en', key, params);

const DEFAULT_CONTEXT: LocaleContextValue = {
  locale: 'en',
  setLocale: () => {},
  t: defaultTranslate,
};

const LocaleContext = createContext<LocaleContextValue>(DEFAULT_CONTEXT);

export interface LocaleProviderProps {
  children: ReactNode;
  /** Optional initial locale override (useful in tests). */
  initialLocale?: Locale;
  /** Optional catalog overrides (useful in tests). */
  catalogs?: Record<Locale, PartialMessageCatalog>;
}

export function LocaleProvider({
  children,
  initialLocale,
  catalogs = CATALOGS,
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale && isSupportedLocale(initialLocale)) {
      return initialLocale;
    }
    return safeGetStoredLocale() ?? 'en';
  });

  // Sync <html lang="..."> and format.ts locale whenever locale changes.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
    setFormatLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (!isSupportedLocale(next)) return;
    safeSetStoredLocale(next);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next;
    }
    setFormatLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback<TranslateFn>(
    (key, params) => translate(locale, key, params, catalogs),
    [locale, catalogs],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

/** Access the current locale, setter, and `t` function. */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** Access the typed translation function `t(key, params?)`. */
export function useT(): TranslateFn {
  return useContext(LocaleContext).t;
}
