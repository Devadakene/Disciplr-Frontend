import { en } from './en';
import { es } from './es';
import type {
  Locale,
  MessageKey,
  PartialMessageCatalog,
  TranslationParams,
} from './types';

export const CATALOGS: Record<Locale, PartialMessageCatalog> = {
  en,
  es,
};

const warnedMissingKeys = new Set<string>();

/** Reset the deduplication cache for missing-key warnings (intended for tests). */
export function resetMissingKeyWarnings(): void {
  warnedMissingKeys.clear();
}

function selectPluralForm(
  template: string,
  count: number,
  locale: Locale,
): string {
  const parts = template.split('|');
  if (parts.length < 2) return template;

  let rule: Intl.LDMLPluralRule;
  try {
    rule = new Intl.PluralRules(locale).select(count);
  } catch {
    rule = count === 1 ? 'one' : 'other';
  }

  return rule === 'one' ? parts[0] : parts[1];
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match,
  );
}

/**
 * Translate a typed message key for the given locale.
 *
 * - Falls back to English when a key is missing in a non-English catalog.
 * - Logs a dev-only `console.warn` once per `(locale, key)` pair on fallback.
 * - Supports `{count}` plural selection (`singular|plural`) and `{var}` interpolation.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: TranslationParams,
  catalogs: Record<Locale, PartialMessageCatalog> = CATALOGS,
): string {
  const catalog = catalogs[locale];
  let template = catalog?.[key];

  if (template === undefined) {
    if (locale !== 'en' && import.meta.env.DEV) {
      const warnKey = `${locale}:${key}`;
      if (!warnedMissingKeys.has(warnKey)) {
        warnedMissingKeys.add(warnKey);
        // eslint-disable-next-line no-console
        console.warn(
          `[i18n] Missing translation for key "${key}" in locale "${locale}"; falling back to "en".`,
        );
      }
    }
    template = en[key];
  }

  if (params && typeof params.count === 'number' && template.includes('|')) {
    template = selectPluralForm(template, params.count, locale);
  }

  return interpolate(template, params);
}
