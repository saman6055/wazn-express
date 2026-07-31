/**
 * Choosing which title and summary a tutorial shows.
 *
 * A tutorial spoken in one language has exactly one title, written in that
 * language and kept in the canonical column — there is nothing to pick
 * between, and the portal only ever shows that video to customers reading in
 * the same language anyway.
 *
 * The exception is a video with no speech (`language: "all"`), which appears
 * in every portal. That one does carry a title per language, so here the
 * customer's own language decides.
 */

type Localised = {
  language?: string | null;
  titleKu?: string | null;
  titleEn?: string | null;
  titleAr?: string | null;
  summaryKu?: string | null;
  summaryEn?: string | null;
  summaryAr?: string | null;
};

/** Videos with no speech, shown in every portal. */
export const TUTORIAL_LANGUAGE_ANY = "all";

function pick(
  canonical: string | null | undefined,
  en: string | null | undefined,
  ar: string | null | undefined,
  isEveryPortal: boolean,
  readingLanguage: string,
): string {
  if (!isEveryPortal) return canonical ?? "";
  if (readingLanguage === "ar" && ar) return ar;
  if (readingLanguage === "en" && en) return en;
  // Kurdish, Chinese, or a missing translation all fall back to the canonical
  // column — it is the only one guaranteed to be filled in.
  return canonical ?? "";
}

export function tutorialTitle(t: Localised, readingLanguage: string): string {
  return pick(t.titleKu, t.titleEn, t.titleAr, t.language === TUTORIAL_LANGUAGE_ANY, readingLanguage);
}

export function tutorialSummary(t: Localised, readingLanguage: string): string {
  return pick(t.summaryKu, t.summaryEn, t.summaryAr, t.language === TUTORIAL_LANGUAGE_ANY, readingLanguage);
}
