/**
 * Dates as plain numbers — one standard for the whole system: 28/07/2026.
 *
 * The owner's choice, taken from the portal's own format (lib/portalClock):
 * day first, both parts padded, four-digit year, so 05/03 can only mean one
 * day. Staff screens used to call toLocaleDateString('ku' | 'ku-IQ' |
 * 'ku-Arab'). Chrome ships none of those (supportedLocalesOf returns nothing
 * for them), so every call fell back to the machine's own locale — on an
 * American-English Windows, 28 July printed as 7/28/2026, month first.
 *
 * Slashes and colons are number separators to the bidi algorithm, so these
 * stay in order inside Kurdish text without a dir wrapper. An invalid date
 * prints a dash rather than "Invalid Date".
 */

const pad = (n: number) => String(n).padStart(2, "0");
const valid = (d: Date) => d instanceof Date && !Number.isNaN(d.getTime());

export const fmtDate = (d: Date) =>
  valid(d) ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "—";

export const fmtTime = (d: Date, withSeconds = false) =>
  valid(d)
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? `:${pad(d.getSeconds())}` : ""}`
    : "—";

export const fmtDateTime = (d: Date) => (valid(d) ? `${fmtTime(d)} · ${fmtDate(d)}` : "—");

/**
 * A moment, written (owner, 2026-09-23).
 *
 * "Take out all these dates written as today, yesterday, this week, last
 * week. Write the date properly — and when we go into the detail of a thing,
 * write the clock as well."
 *
 * He is right about more than tidiness: "3 days ago" is a different sentence
 * every day it is read, so two people looking at the same screen a week apart
 * see different text for the same fact, and neither can quote it back. A
 * written date is the same fact for ever.
 *
 * Takes whatever a payload holds — a Date, an ISO string, a timestamp — and
 * gives back the house's own format, with the clock in front of it when the
 * screen is a detail rather than a list. Nothing, or nonsense, prints a dash.
 */
export const fmtWhen = (value: Date | string | number | null | undefined, withTime = false): string => {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (!valid(d)) return "—";
  return withTime ? fmtDateTime(d) : fmtDate(d);
};

/** Month and year only, for month pickers and month-grouped reports: 07/2026. */
export const fmtMonth = (d: Date) => (valid(d) ? `${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "—");
