/**
 * The language a tutorial video is spoken in.
 *
 * The portal shows a customer only the videos spoken in the language they are
 * browsing in — a Kurdish narration is no help to someone reading in Arabic,
 * whatever the title says. `all` is for videos with no speech at all (a plain
 * screen recording), which belong in every portal.
 *
 * Each name is written in its own language, so the owner picking one and the
 * customer seeing one both read it natively.
 */
export const LANGUAGE_NAME = {
  ku: "کوردی",
  en: "English",
  ar: "العربية",
  zh: "中文",
  all: "هەموو زمانەکان",
} as const;

export type TutorialLanguage = keyof typeof LANGUAGE_NAME;

/** Editor order: the languages first, then the every-portal option. */
export const TUTORIAL_LANGUAGES: TutorialLanguage[] = ["ku", "en", "ar", "zh", "all"];
