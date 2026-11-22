import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  useLocale,
  type Locale,
} from '../i18n';

export default function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();

  return (
    <select
      aria-label={t('i18n.selectLanguage')}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '0.35rem 0.5rem',
        color: 'var(--text)',
        font: 'inherit',
        fontSize: '0.8125rem',
        cursor: 'pointer',
      }}
    >
      {SUPPORTED_LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
