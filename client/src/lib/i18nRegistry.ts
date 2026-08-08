import type { Language } from "@/contexts/LanguageContext";

/**
 * The four translation files, loaded one at a time instead of all at once.
 *
 * They were static imports, so every visitor downloaded Kurdish, English,
 * Arabic and Chinese before anything could render — about 1 MB of JSON, which
 * measured at roughly 63% of the entry chunk. Three of those four are a
 * language the reader will never choose, and a customer on an Iraqi mobile
 * connection paid for all of them on every first load.
 *
 * Now a locale is fetched when it is actually needed. `t()` stays synchronous,
 * which is what keeps this a two-file change rather than a rewrite of every
 * caller: the active locale is awaited in main.tsx before React mounts, so by
 * the time any component reads a string it is already here. The boot screen
 * covers that wait, and it is a shorter wait than before because it is one
 * file rather than four.
 */

type TranslationValue = string | { [key: string]: TranslationValue };
export type Translations = { [key: string]: TranslationValue };

const loaded: Partial<Record<Language, Translations>> = {};
const inFlight: Partial<Record<Language, Promise<void>>> = {};

const LOADERS: Record<Language, () => Promise<{ default: unknown }>> = {
  ku: () => import("../locales/ku.json"),
  en: () => import("../locales/en.json"),
  ar: () => import("../locales/ar.json"),
  zh: () => import("../locales/zh.json"),
};

/** Already here? Used by the synchronous `t()`. */
export function getLocale(language: Language): Translations | undefined {
  return loaded[language];
}

export function isLocaleLoaded(language: Language): boolean {
  return loaded[language] !== undefined;
}

/** Fetch a locale once. Concurrent callers share the same request. */
export function loadLocale(language: Language): Promise<void> {
  if (loaded[language]) return Promise.resolve();
  const existing = inFlight[language];
  if (existing) return existing;

  const promise = LOADERS[language]()
    .then((mod) => {
      loaded[language] = (mod.default ?? mod) as Translations;
    })
    .catch(() => {
      // A failed locale must not take the app down. `t()` falls back to the
      // key, which is ugly but readable, and a reload will try again.
      loaded[language] = {};
    })
    .finally(() => {
      delete inFlight[language];
    });

  inFlight[language] = promise;
  return promise;
}

/**
 * Warm the two fallback locales in the background.
 *
 * `t()` falls back through Kurdish then English when a key is missing. Those
 * files are in four-language parity today (portal-audit.test.ts holds that),
 * so the chain is close to dead code — which is exactly why it should not
 * block the first paint. It is fetched after the app is already interactive.
 */
export function warmFallbackLocales(): void {
  if (typeof window === "undefined") return;
  const warm = () => {
    void loadLocale("ku");
    void loadLocale("en");
  };
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(warm, { timeout: 4000 });
  } else {
    setTimeout(warm, 2000);
  }
}
