import type { en } from './en';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

export type MessageKey = keyof typeof en;

export type MessageCatalog = Record<MessageKey, string>;

export type PartialMessageCatalog = Partial<MessageCatalog>;

export type TranslationParams = Record<string, string | number>;
