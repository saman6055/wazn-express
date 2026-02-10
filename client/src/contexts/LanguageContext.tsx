import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Import language files
import kuTranslations from '../locales/ku.json';
import enTranslations from '../locales/en.json';
import arTranslations from '../locales/ar.json';
import zhTranslations from '../locales/zh.json';

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

const translations: Record<Language, Translations> = {
  ku: kuTranslations as Translations,
  en: enTranslations as Translations,
  ar: arTranslations as Translations,
  zh: zhTranslations as Translations,
};

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

  const languageInfo = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
  const direction = languageInfo.direction;
  const isRTL = direction === 'rtl';

  // Set language and persist to localStorage
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  // Translation function
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const currentTranslations = translations[language];
    const value = getNestedValue(currentTranslations, key);
    
    // Debug: log missing translations
    if (!value && key !== 'undefined') {
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

  return (
    <LanguageContext.Provider value={{ language, languageInfo, setLanguage, t, direction, isRTL }}>
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
