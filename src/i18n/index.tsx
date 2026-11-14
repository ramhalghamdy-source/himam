import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translate, type Language, type TKey } from './translations';

const LANGUAGE_KEY = 'himam.language.v1';
type Translator = (key: TKey, params?: Record<string, string | number>) => string;
type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translator;
  tp: (key: TKey, count: number) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function initialLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* private browsing */ }
  }, [language]);
  const t = useCallback<Translator>((key, params) => translate(language, key, params), [language]);
  const tp = useCallback((key: TKey, count: number) => {
    if (key === 'streak.count') {
      return language === 'ar' ? count + ' ' + (count === 1 ? 'يوم' : 'أيام') : count + (count === 1 ? ' day' : ' days');
    }
    return t(key, { n: count });
  }, [language, t]);
  const value = useMemo(() => ({ language, setLanguage, t, tp }), [language, t, tp]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n requires I18nProvider');
  return context;
}
