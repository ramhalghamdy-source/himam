import { useI18n } from '../i18n';
import { GlobeIcon } from './Icons';

/** One-tap switch between Arabic and English. The label shows the language you will switch TO. */
export function LanguageToggle() {
  const { t, toggleLang } = useI18n();
  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={toggleLang}
      aria-label={t('lang.switchAria')}
      title={t('lang.switchAria')}
    >
      <GlobeIcon />
      <span>{t('lang.switchLabel')}</span>
    </button>
  );
}
