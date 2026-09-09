/**
 * Dates as plain numbers, the way the owner reads them: 8.9.2026.
 *
 * One formatter for every staff screen, because the alternative was month
 * names in four languages and "days ago 4" in a Kurdish sentence. Wrap the
 * output in dir="ltr" wherever it sits in RTL text, or the digits shuffle.
 */

export const fmtDate = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;

export const fmtDateTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} · ${fmtDate(d)}`;
