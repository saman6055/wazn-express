/**
 * The clock and date shown in the portal header.
 *
 * Intl has no usable Sorani Kurdish locale, so the Kurdish weekday and month
 * names are written out here. The other three languages go through Intl, which
 * already knows them.
 *
 * Digits stay Latin in every language. A clock is read at a glance, and
 * Arabic-Indic numerals in the time slowed that down without adding anything —
 * the numbers on a phone's own status bar are Latin too.
 */

const KU_WEEKDAYS = [
  "یەکشەممە",
  "دووشەممە",
  "سێشەممە",
  "چوارشەممە",
  "پێنجشەممە",
  "هەینی",
  "شەممە",
];

const KU_MONTHS = [
  "کانوونی دووەم",
  "شوبات",
  "ئازار",
  "نیسان",
  "ئایار",
  "حوزەیران",
  "تەممووز",
  "ئاب",
  "ئەیلوول",
  "تشرینی یەکەم",
  "تشرینی دووەم",
  "کانوونی یەکەم",
];

/** Before-noon / after-noon marker, in each language's own convention. */
const MERIDIEM: Record<string, [string, string]> = {
  ku: ["پ.ن", "د.ن"],
  ar: ["ص", "م"],
  zh: ["上午", "下午"],
  en: ["AM", "PM"],
};

export const CLOCK_HOUR12_KEY = "portal-clock-hour12";

/**
 * The time, in 24-hour form by default.
 *
 * 12-hour form appends the language's own meridiem marker — Kurdish has no
 * settled short form, so پ.ن / د.ن is spelled the way it is said.
 */
export function formatClockTime(date: Date, language: string, hour12 = false): string {
  const h24 = date.getHours();
  const mm = String(date.getMinutes()).padStart(2, "0");

  if (!hour12) return `${String(h24).padStart(2, "0")}:${mm}`;

  // 0 and 12 both display as 12 — midnight is 12 AM, noon is 12 PM.
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const marker = (MERIDIEM[language] ?? MERIDIEM.en)[h24 < 12 ? 0 : 1];
  return `${h12}:${mm} ${marker}`;
}

/** Weekday and day-of-month — enough to orient, short enough for the header. */
export function formatClockDate(date: Date, language: string): string {
  if (language === "ku") {
    return `${KU_WEEKDAYS[date.getDay()]}، ${date.getDate()}ی ${KU_MONTHS[date.getMonth()]}`;
  }

  const locale = language === "ar" ? "ar" : language === "zh" ? "zh-CN" : "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      // Latin digits, so the date matches the time sitting right above it.
      numberingSystem: "latn",
    }).format(date);
  } catch {
    // A browser without the locale data still gets a readable date rather
    // than an empty header.
    return date.toDateString();
  }
}

/**
 * Milliseconds until the top of the next minute. The header ticks on the
 * minute instead of every second — the seconds are never shown, so a
 * per-second timer would re-render for nothing.
 */
export function msUntilNextMinute(date: Date): number {
  return 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds());
}
