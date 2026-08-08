/**
 * A notification row, in the language the customer is reading.
 *
 * The row carries `title`/`titleKu`/`titleAr`/`titleZh` and the matching
 * messages, written by whoever raised it. Two screens render these — the
 * notifications centre and the panel on the messages page — and each had
 * written its own picker. They disagreed: neither knew about Chinese, and the
 * messages page also required the translation to be non-empty before it would
 * even consider the language, so a row whose Kurdish title was blank silently
 * fell all the way back to English.
 *
 * One reader, so the same notification cannot read differently depending on
 * which screen the customer happened to open it from.
 *
 * `title` and `message` remain the fallback: older rows have no translations
 * at all, and the default text is better than an empty line.
 */
export function notificationText(
  row: Record<string, unknown> | null | undefined,
  field: "title" | "message",
  language: string,
): string {
  if (!row) return "";
  const suffix =
    language === "ku" ? "Ku" : language === "ar" ? "Ar" : language === "zh" ? "Zh" : null;
  const translated = suffix ? row[field + suffix] : null;
  if (typeof translated === "string" && translated.trim()) return translated;
  const base = row[field];
  return typeof base === "string" ? base : "";
}
