import { useI18n } from '../i18n';

export function LanguageToggle() {
  const { language, setLanguage } = useI18n();
  return (
    <div className="language-toggle" role="group" aria-label="Language / اللغة">
      <button type="button" className={language === 'en' ? 'selected' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
      <button type="button" className={language === 'ar' ? 'selected' : ''} aria-pressed={language === 'ar'} onClick={() => setLanguage('ar')}>عربي</button>
    </div>
  );
}
