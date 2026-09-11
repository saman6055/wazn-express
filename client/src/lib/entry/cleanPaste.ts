/**
 * What a paste from WhatsApp, WeChat or 1688 carries besides the number.
 *
 * A tracking number copied out of a chat arrives with a Chinese label
 * ("运单号："), spaces between its groups, full-width letters from a Chinese
 * keyboard (ＹＴ１２３) and invisible direction marks. The search then finds
 * nothing and the number is typed again by hand. These keep only what the
 * number is made of. Nothing here is sent anywhere or stored.
 */

// Zero-width spaces and joiners, direction marks and isolates, the BOM.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Eastern Arabic (U+0660–0669) and Persian (U+06F0–06F9) digits become 0-9; full-width forms their plain twins. */
export function toPlainDigits(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** One tracking number: letters, digits and dashes, in capitals — everything else dropped. */
export function cleanTrackingPaste(text: string): string {
  return toPlainDigits(text)
    .replace(INVISIBLE, "")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

/**
 * Several numbers pasted at once — one per line, or split by commas or
 * semicolons (Latin, Arabic or Chinese). Spaces do not split: a number copied
 * as "SF 1234 5678" is still one number.
 */
export function splitTrackingPaste(text: string): string[] {
  return text
    .split(/[\r\n,;\u060C\u061B\u3001\uFF0C\uFF1B]+/)
    .map(cleanTrackingPaste)
    .filter((n) => n.length > 0);
}

/** A figure typed or pasted into a number box: Eastern digits and the Arabic decimal comma read as 12.5; "1,250" → "1250". */
export function cleanNumberPaste(text: string): string {
  return toPlainDigits(text)
    .replace(INVISIBLE, "")
    .replace(/\u066B/g, ".") // Arabic decimal separator
    .replace(/[,\s\u066C]/g, ""); // thousands separators, Latin and Arabic
}
