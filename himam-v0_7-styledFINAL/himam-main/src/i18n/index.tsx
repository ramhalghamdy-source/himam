import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ar, en, plurals, type PKey, type TKey } from './translations';

export type Lang = 'en' | 'ar';
export type Params = Record<string, string | number>;
/** A message that can be translated later, so it follows the language toggle. */
export type Msg = TKey | { k: TKey; p?: Params };

const STORAGE_KEY = 'himam.lang';
const DICTS: Record<Lang, Record<TKey, string>> = { en, ar };

function interpolate(template: string, params?: Params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* storage can be blocked; fall through */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')
    ? 'ar'
    : 'en';
}

type I18nValue = {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  /** BCP-47 locale for Intl (Latin digits are kept in Arabic on purpose). */
  locale: string;
  t: (key: TKey, params?: Params) => string;
  tp: (key: PKey, n: number, params?: Params) => string;
  tm: (msg: Msg) => string;
  toggleLang: () => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const locale = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US';
    const t: I18nValue['t'] = (key, params) => interpolate(DICTS[lang][key] ?? en[key], params);
    const tp: I18nValue['tp'] = (key, n, params) => {
      const forms = plurals[lang][key];
      const category = new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en').select(n);
      const template = forms[category] ?? forms.other ?? '{n}';
      return interpolate(template, { n, ...params });
    };
    const tm: I18nValue['tm'] = (msg) => (typeof msg === 'string' ? t(msg) : t(msg.k, msg.p));
    return {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      locale,
      t,
      tp,
      tm,
      toggleLang: () => setLang((current) => (current === 'ar' ? 'en' : 'ar')),
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

/** Stable helper for dynamic keys such as `domain.${id}`. */
export function useKey() {
  const { t } = useI18n();
  return useCallback((prefix: string, id: string, params?: Params) => t(`${prefix}.${id}` as TKey, params), [t]);
}
