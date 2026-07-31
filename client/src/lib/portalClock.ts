/**
 * The clock and date shown in the portal header.
 *
 * Intl has no usable Sorani Kurdish locale, so the Kurdish weekday and month
 * names are written out here. The other three languages go through Intl, which
 * already knows them.
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

const ARABIC_INDIC = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Kurdish and Arabic read numbers in Arabic-Indic digits throughout the app. */
export function toArabicIndic(value: string): string {
  return value.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

/**
 * 24-hour clock. Unambiguous in every language, and it avoids an AM/PM marker
 * that has no settled short form in Kurdish.
 */
export function formatClockTime(date: Date, language: string): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  return language === "ku" || language === "ar" ? toArabicIndic(time) : time;
}

/** Weekday and day-of-month — enough to orient, short enough for the header. */
export function formatClockDate(date: Date, language: string): string {
  if (language === "ku") {
    const day = toArabicIndic(String(date.getDate()));
    return `${KU_WEEKDAYS[date.getDay()]}، ${day}ی ${KU_MONTHS[date.getMonth()]}`;
  }

  const locale = language === "ar" ? "ar" : language === "zh" ? "zh-CN" : "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
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
