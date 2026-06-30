// Small helper to replace the legacy `isKurdish ? "ku" : "en"` binary pattern,
// which silently fell back to English for Arabic and Chinese. Pass all four
// languages and it returns the right one for the active UI language (English
// as the ultimate fallback).
export type Lang = "ku" | "en" | "ar" | "zh";

export interface LangStrings {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

export function pickLang(lang: string | undefined, v: LangStrings): string {
  switch (lang) {
    case "ku":
      return v.ku;
    case "ar":
      return v.ar;
    case "zh":
      return v.zh;
    default:
      return v.en;
  }
}
