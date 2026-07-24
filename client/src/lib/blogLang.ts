// ---------------------------------------------------------------------------
// blogLang — language rules for Wazn News / announcements posts.
//
// Posts are authored in up to THREE languages: Kurdish, English, Arabic. There
// is no Chinese authoring field, so the Chinese UI reads the English version.
//
// Core rule (what the admin asked for): a post is shown to a language's readers
// ONLY if it was actually written in that language. A Kurdish-only post never
// leaks into the Arabic / English feeds rendered as Kurdish text, and an
// Arabic-only post shows only to Arabic readers. No cross-language fallback in
// the browsing feeds (ticker, carousel, news list).
//
// Single source of truth so every surface behaves identically.
// ---------------------------------------------------------------------------

export type BlogTextBase = "title" | "summary" | "content";

/** The authoring language a UI language maps to (zh has no field → English). */
function authorLang(language: string): "ku" | "en" | "ar" {
  if (language === "ku") return "ku";
  if (language === "ar") return "ar";
  return "en"; // English + Chinese
}

/** Column suffix for a localized field, e.g. "ku" → "Ku". */
function suffix(l: "ku" | "en" | "ar"): "Ku" | "En" | "Ar" {
  return (l.charAt(0).toUpperCase() + l.slice(1)) as "Ku" | "En" | "Ar";
}

/**
 * Localized post field for the reader's language, with NO cross-language
 * fallback. Returns "" when the post has no text in that language.
 */
export function postText(post: any, base: BlogTextBase, language: string): string {
  if (!post) return "";
  return (post[`${base}${suffix(authorLang(language))}`] as string) || "";
}

/** First non-empty value of a field across ku/en/ar (used only as a last resort). */
export function anyPostText(post: any, base: BlogTextBase): string {
  if (!post) return "";
  return (post[`${base}En`] as string) || (post[`${base}Ku`] as string) || (post[`${base}Ar`] as string) || "";
}

/** Is this post authored in the reader's language? (its title is present) */
export function isPostInLanguage(post: any, language: string): boolean {
  return !!postText(post, "title", language);
}

/** Keep only the posts written in the reader's language. */
export function filterPostsByLanguage<T>(posts: T[] | undefined | null, language: string): T[] {
  return (posts ?? []).filter((p) => isPostInLanguage(p, language));
}
