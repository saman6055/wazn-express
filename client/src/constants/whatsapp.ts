/**
 * The support WhatsApp number, and the four-language text shape — on their
 * own, in a file with nothing else in it.
 *
 * They lived in portalTerms.ts, beside a thousand lines of terms in four
 * languages. The company logo reads the number (logo → brand → contact
 * channels), and the logo is on every page — so every page, the sign-in
 * screens included, downloaded the whole terms text to read one phone number.
 * portalTerms.ts re-exports both, so nothing that imports them there changes.
 */

export type L10n = { ku: string; en: string; ar: string; zh: string };

/**
 * WhatsApp support number in international (wa.me) format: +964 770 918 3535.
 *
 * The one copy. It had been re-declared in four files and inlined raw in a
 * fifth, which meant changing the company's number would have updated some
 * screens and silently left the rest messaging the old one — the kind of
 * split nobody notices until a customer does. portal-audit.test.ts fails on
 * any new hardcoded wa.me number outside this file.
 */
export const TERMS_WHATSAPP_NUMBER = "9647709183535";
