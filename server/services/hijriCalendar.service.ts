import { appLogger } from "../utils/logger";

/**
 * When Ramadan and the two Eids fall this year.
 *
 * These cannot be computed and trusted. In Iraq they are set by sighting the
 * moon, and an arithmetic calendar can be a day out either way — which for a
 * greeting is the whole difference between a kindness and an embarrassment.
 * So the dates are fetched from a public Islamic calendar service, cached for
 * the year, and fall back to the calculated ones only so the feature degrades
 * rather than disappears.
 *
 * Two rules this file exists to keep.
 *
 * Only dates cross the wire. No customer information is sent — the request
 * carries a year and nothing else — and no text comes back into the product.
 * Every word a customer reads lives in shared/occasions.ts, in four
 * languages, where somebody can read it before it is sent. A greeting fetched
 * from a stranger and shown to a customer is not something this company can
 * stand behind.
 *
 * And nothing here may ever throw. A calendar service being down is not a
 * reason for the portal to fail; it is a reason for one card not to appear.
 */

export interface HijriOccasionDates {
  ramadanStart: Date | null;
  eidFitr: Date | null;
  eidAdha: Date | null;
  hijriNewYear: Date | null;
  mawlid: Date | null;
  /** Where these came from, so the admin screen can say so honestly. */
  source: "network" | "calculated" | "none";
  fetchedAt: Date;
}

/** The Hijri month and day each occasion falls on. */
const HIJRI_POINTS = [
  { field: "hijriNewYear", month: 1, day: 1 },
  { field: "mawlid", month: 3, day: 12 },
  { field: "ramadanStart", month: 9, day: 1 },
  { field: "eidFitr", month: 10, day: 1 },
  { field: "eidAdha", month: 12, day: 10 },
] as const;

let cache: { year: number; value: HijriOccasionDates } | null = null;

/**
 * The calculated fallback, from the runtime's own Umm al-Qura calendar.
 *
 * Walks the Gregorian year and asks each day what Hijri date it is. Crude,
 * but it runs once a year, needs no network, and is never wrong by more than
 * the calendar itself is.
 */
function calculateFromRuntime(gregorianYear: number): Partial<HijriOccasionDates> {
  const out: Partial<HijriOccasionDates> = {};
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC",
    });
  } catch {
    return out;
  }

  const seen = new Set<string>();
  for (let d = new Date(Date.UTC(gregorianYear, 0, 1)); d.getUTCFullYear() === gregorianYear; d.setUTCDate(d.getUTCDate() + 1)) {
    const parts = formatter.formatToParts(d);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    for (const point of HIJRI_POINTS) {
      if (month === point.month && day === point.day && !seen.has(point.field)) {
        seen.add(point.field);
        (out as any)[point.field] = new Date(d.getTime());
      }
    }
  }
  return out;
}

/**
 * Ask a public Islamic calendar service for the same points.
 *
 * aladhan.com's converter is the one most widely used across the region and
 * follows the same Umm al-Qura basis the local announcements start from. It
 * returns a Gregorian date for a Hijri one, which is all that is wanted here.
 */
async function fetchFromNetwork(hijriYear: number): Promise<Partial<HijriOccasionDates>> {
  const out: Partial<HijriOccasionDates> = {};
  for (const point of HIJRI_POINTS) {
    try {
      const controller = new AbortController();
      // A greeting is not worth holding a request open for. If the service is
      // slow, the calculated date is already good enough.
      const timer = setTimeout(() => controller.abort(), 6000);
      const url = `https://api.aladhan.com/v1/hToG?date=${point.day}-${point.month}-${hijriYear}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const body = await res.json() as any;
      const g = body?.data?.gregorian?.date; // dd-mm-yyyy
      if (typeof g !== "string") continue;
      const [dd, mm, yyyy] = g.split("-").map(Number);
      if (!dd || !mm || !yyyy) continue;
      const parsed = new Date(Date.UTC(yyyy, mm - 1, dd));
      if (!Number.isNaN(parsed.getTime())) (out as any)[point.field] = parsed;
    } catch (err) {
      appLogger.warn("[Hijri] lookup failed, falling back to the calculated date", {
        point: point.field, error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

/** Which Hijri year the middle of this Gregorian year sits in. */
function hijriYearFor(gregorianYear: number): number {
  try {
    const mid = new Date(Date.UTC(gregorianYear, 6, 1));
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", timeZone: "UTC" })
      .formatToParts(mid);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    if (Number.isFinite(year)) return year;
  } catch { /* fall through */ }
  // The usual approximation, good enough to ask a converter with.
  return Math.round((gregorianYear - 622) * 1.0307);
}

/**
 * This year's dates, network first and calculation second.
 *
 * Cached for the process: these move once a year, and a portal home screen
 * must not reach across the internet on every load.
 */
export async function getHijriOccasionDates(
  gregorianYear = new Date().getFullYear(),
): Promise<HijriOccasionDates> {
  if (cache && cache.year === gregorianYear) return cache.value;

  const calculated = calculateFromRuntime(gregorianYear);
  let merged: Partial<HijriOccasionDates> = calculated;
  let source: HijriOccasionDates["source"] = Object.keys(calculated).length > 0 ? "calculated" : "none";

  try {
    /**
     * Two Hijri years, not one.
     *
     * A Hijri year straddles two Gregorian ones: asking only the year that
     * contains this July returns a Ramadan that falls next January, and this
     * year's Ramadan — which was in February — is missed entirely. Nothing
     * fails; the greeting simply never appears, which is the worst kind of
     * bug to have in something nobody is watching.
     *
     * So both are asked, and only the dates that actually land inside the
     * Gregorian year being asked about are kept.
     */
    const centre = hijriYearFor(gregorianYear);
    const [earlier, later] = await Promise.all([
      fetchFromNetwork(centre - 1),
      fetchFromNetwork(centre),
    ]);
    const inThisYear = (v: unknown) => v instanceof Date && v.getUTCFullYear() === gregorianYear;
    const fetched: Partial<HijriOccasionDates> = {};
    for (const source of [earlier, later]) {
      for (const [field, value] of Object.entries(source)) {
        if (inThisYear(value)) (fetched as any)[field] = value;
      }
    }
    if (Object.keys(fetched).length > 0) {
      // Network wins where it answered; the calculation fills the rest, so a
      // half-answered lookup still leaves a complete year.
      merged = { ...calculated, ...fetched };
      source = "network";
    }
  } catch (err) {
    appLogger.error("[Hijri] calendar lookup failed entirely", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const value: HijriOccasionDates = {
    ramadanStart: merged.ramadanStart ?? null,
    eidFitr: merged.eidFitr ?? null,
    eidAdha: merged.eidAdha ?? null,
    hijriNewYear: merged.hijriNewYear ?? null,
    mawlid: merged.mawlid ?? null,
    source,
    fetchedAt: new Date(),
  };
  cache = { year: gregorianYear, value };
  return value;
}

/** Drop the cache — for a test, or for an admin who has just corrected a date. */
export function clearHijriCache(): void {
  cache = null;
}
