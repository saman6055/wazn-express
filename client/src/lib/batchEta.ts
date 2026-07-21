// Estimated-arrival helper for customer-facing batch views.
// Prefers the staff-set `estimatedArrival`; falls back to a range derived
// from the departure date + shipping type (air 7–14 days, sea 30–45 days).
// Returns null when the batch has already arrived or nothing can be derived.

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

/** Short display string, e.g. "12 Aug" or "5–12 Aug". */
export function formatBatchEta(eta: BatchEta, locale = "en-GB"): string {
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  if (eta.kind === "exact") return fmt(eta.date);
  return `${fmt(eta.from)} – ${fmt(eta.to)}`;
}
