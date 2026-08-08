import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

// The four locale files are ~1 MB of JSON and used to be static imports, so
// every visitor downloaded all four — three of them a language they will never
// read — before the app could paint. They are fetched one at a time now; see
// lib/i18nRegistry. main.tsx awaits the active one before mounting React, so
// everything below stays synchronous.
import { getLocale, loadLocale, warmFallbackLocales } from '../lib/i18nRegistry';

// Language types
export type Language = 'ku' | 'en' | 'ar' | 'zh';

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  flag: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'ku', name: 'Kurdish', nativeName: 'کوردی', direction: 'rtl', flag: '🇮🇶' },
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇬🇧' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flag: '🇸🇦' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', flag: '🇨🇳' },
];

// Translations type
type TranslationValue = string | { [key: string]: TranslationValue };
type Translations = { [key: string]: TranslationValue };

/** Whatever is loaded right now. A locale that has not arrived reads as empty,
 *  which sends `t()` down its normal fallback chain rather than throwing. */
const translations = new Proxy({} as Record<Language, Translations>, {
  get: (_t, lang: string) => getLocale(lang as Language) ?? {},
});

// Context type
interface LanguageContextType {
  language: Language;
  languageInfo: LanguageInfo;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Storage key
const LANGUAGE_STORAGE_KEY = 'wazn-express-language';

// Get nested value from object using dot notation
function getNestedValue(obj: Translations, path: string): string | undefined {
  const keys = path.split('.');
  let current: TranslationValue = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return typeof current === 'string' ? current : undefined;
}

// Replace template variables
function replaceParams(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key]?.toString() ?? `{{${key}}}`;
  });
}

// Standalone translator bound to a SPECIFIC language, independent of the
// active UI language. Used by export/print flows that must render in a
// chosen language regardless of what the user is currently viewing — e.g.
// the delivery-box receipt that staff can print in Kurdish, Arabic, or
// English on demand. Mirrors the in-context `t` callback's ku→en fallback
// chain so a missing key behaves identically.
export type Translator = (key: string, params?: Record<string, string | number>) => string;

export function createTranslator(language: Language): Translator {
  return (key, params) => {
    const value = getNestedValue(translations[language], key);
    if (value) return replaceParams(value, params);
    if (language !== 'ku') {
      const ku = getNestedValue(translations.ku, key);
      if (ku) return replaceParams(ku, params);
    }
    if (language !== 'en') {
      const en = getNestedValue(translations.en, key);
      if (en) return replaceParams(en, params);
    }
    return key;
  };
}

export function getLanguageDirection(language: Language): 'ltr' | 'rtl' {
  return (LANGUAGES.find(l => l.code === language) || LANGUAGES[0]).direction;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Get initial language from localStorage or default to Kurdish
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && ['ku', 'en', 'ar', 'zh'].includes(stored)) {
        return stored as Language;
      }
    }
    return 'ku';
  });

  const languageInfo = useMemo(
    () => LANGUAGES.find(l => l.code === language) || LANGUAGES[0],
    [language]
  );
  const direction = languageInfo.direction;
  const isRTL = direction === 'rtl';

  // Set language and persist to localStorage. The file is fetched first, so
  // the switch lands on translated text rather than flashing raw keys.
  const setLanguage = useCallback((lang: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    void loadLocale(lang).then(() => setLanguageState(lang));
  }, []);

  // The fallback chain (ku, then en) only fires on a missing key, and the
  // locale files are in four-language parity — so it is fetched once the app
  // is already interactive rather than ahead of the first paint.
  useEffect(() => {
    warmFallbackLocales();
  }, []);

  // Translation function
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const currentTranslations = translations[language];
    const value = getNestedValue(currentTranslations, key);
    
    // Debug: log missing translations (dev only)
    if (import.meta.env.DEV && !value && key !== 'undefined') {
      console.log(`[i18n] Missing translation for key: "${key}" in language: ${language}`);
    }
    
    if (value) {
      return replaceParams(value, params);
    }
    
    // Fallback to Kurdish if not found
    if (language !== 'ku') {
      const fallbackValue = getNestedValue(translations.ku, key);
      if (fallbackValue) {
        return replaceParams(fallbackValue, params);
      }
    }
    
    // Fallback to English if not found in Kurdish
    if (language !== 'en') {
      const fallbackValue = getNestedValue(translations.en, key);
      if (fallbackValue) {
        return replaceParams(fallbackValue, params);
      }
    }
    
    // Return key if not found
    return key;
  }, [language]);

  // Update document direction when language changes
  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [language, direction]);

  const value = useMemo(
    () => ({ language, languageInfo, setLanguage, t, direction, isRTL }),
    [language, languageInfo, setLanguage, t, direction, isRTL]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// Hook to use language context
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Shorthand hook for translation function only
export function useTranslation() {
  const { t, language, direction, isRTL } = useLanguage();
  return { t, language, direction, isRTL };
}

export default LanguageContext;
