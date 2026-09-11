import { toPlainDigits } from "./cleanPaste";

/**
 * Dates typed the quick way: t = today, y = yesterday, +2 = the day after
 * tomorrow, -7 = a week ago (ئەمڕۆ and دوێنێ work too). A written date is
 * read as well: 28/07/2026 or 2026-07-28.
 *
 * The answer is what a date box holds (YYYY-MM-DD, in local time — never
 * through toISOString, which moves the day across midnight in Baghdad), or
 * null when the text is not a date. Never a guess.
 */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function realDate(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  const same = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return same ? toDateInputValue(date) : null; // 31/02 is not rolled into March
}

export function parseDateShortcut(text: string, today: Date = new Date()): string | null {
  const typed = toPlainDigits(text).trim().toLowerCase();
  if (!typed) return null;

  const shift = (days: number) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    date.setDate(date.getDate() + days); // by calendar day, so a clock change cannot skip one
    return toDateInputValue(date);
  };

  if (["t", "today", "ئەمڕۆ", "اليوم", "今天"].includes(typed)) return shift(0);
  if (["y", "yesterday", "دوێنێ", "أمس", "昨天"].includes(typed)) return shift(-1);

  const relative = /^([+-])\s*(\d{1,3})$/.exec(typed);
  if (relative) return shift((relative[1] === "-" ? -1 : 1) * Number(relative[2]));

  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(typed);
  if (dayFirst) return realDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));

  const yearFirst = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(typed);
  if (yearFirst) return realDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));

  return null;
}

/** 2026-07-28 → 28/07/2026, the way the app writes a date everywhere else. */
export function displayDateValue(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
