// Estimated-arrival helper for customer-facing batch views.
// Prefers the staff-set `estimatedArrival`; falls back to a range derived
// from the departure date + shipping type (air 7–14 days, sea 30–45 days).
// Returns null when the batch has already arrived or nothing can be derived.

import { formatPortalDate } from "./portalClock";

export interface BatchEtaInput {
  status?: string | null;
  shippingType?: string | null;
  departureDate?: string | Date | null;
  estimatedArrival?: string | Date | null;
  actualArrival?: string | Date | null;
}

export type BatchEta =
  | { kind: "exact"; date: Date }
  | { kind: "range"; from: Date; to: Date };

const ARRIVED_STATUSES = new Set(["arrived", "delivered", "closed", "completed"]);

const DAYS: Record<string, [number, number]> = {
  air_regular: [7, 14],
  air_irregular: [7, 14],
  sea: [30, 45],
};

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function getBatchEta(batch: BatchEtaInput): BatchEta | null {
  if (!batch) return null;
  if (batch.actualArrival) return null;
  if (batch.status && ARRIVED_STATUSES.has(batch.status)) return null;

  if (batch.estimatedArrival) {
    const date = new Date(batch.estimatedArrival);
    if (!isNaN(date.getTime())) return { kind: "exact", date };
  }

  if (batch.departureDate) {
    const dep = new Date(batch.departureDate);
    const window = DAYS[batch.shippingType ?? ""] ?? null;
    if (!isNaN(dep.getTime()) && window) {
      return { kind: "range", from: addDays(dep, window[0]), to: addDays(dep, window[1]) };
    }
  }

  return null;
}

/**
 * The estimate as the portal writes dates — 12/08/2026, or 05/08 – 12/08/2026
 * for a range.
 *
 * This used to print "12 Aug" through the en-GB locale for every reader: an
 * English month name on a Kurdish page, next to other dates the same screen
 * wrote as dd/mm/yyyy. Every portal date now goes through formatPortalDate,
 * so the estimate reads like the dates around it; the range shares its year
 * once, at the end, because a phone card has no room to say it twice.
 */
export function formatBatchEta(eta: BatchEta, language = "en"): string {
  if (eta.kind === "exact") return formatPortalDate(eta.date, language);
  const from = formatPortalDate(eta.from, language);
  const to = formatPortalDate(eta.to, language);
  if (language === "zh") return `${from} – ${to}`;
  const sameYear = eta.from.getFullYear() === eta.to.getFullYear();
  // "05/08 – 12/08/2026": the year belongs to both ends and is said once.
  return sameYear ? `${from.slice(0, 5)} – ${to}` : `${from} – ${to}`;
}
