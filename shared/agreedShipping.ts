/**
 * «نرخی ڕێککەوتوو» — the shipping price agreed with the customer for one
 * parcel (owner-approved 2026-11-07).
 *
 * The case: a customer bought goods themselves and the office promised the
 * shipping as a fixed amount ($10). The system worked out CBM × rate = $5 (the
 * sea least) and charged that. The owner's rule: «ئەبێ هەر ئەو نرخە بێت کە
 * لەسەر ڕێکەوتووین ئەگەر بە قازانج یا زیانی ئێمەش بێ».
 *
 * So when a parcel carries an agreed amount, that amount IS its shipping
 * charge, above or below the computed price. It overrides the rate, the $5
 * least and the small-parcel extra; a correction of the weight or the volume
 * does not move it. Empty = the computed price, as before.
 *
 * The customer sees only the final price. The office sees the agreed figure,
 * the system's own and the difference (profit green, loss red).
 */

/** The agreed amount in dollars to the cent, or null when none is set. */
export function agreedUsd(value: string | number | null | undefined): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** The charge: the agreed amount when there is one, else the computed price. */
export function withAgreedPrice(computedUsd: number, agreed: string | number | null | undefined): number {
  const a = agreedUsd(agreed);
  return a ?? computedUsd;
}

export interface AgreedPriceView {
  agreedUsd: number;
  /** What the system would charge without the agreement (0 when it cannot say). */
  computedUsd: number;
  /** agreed − computed: + is profit beyond the system's price, − a loss we accepted. */
  differenceUsd: number;
}

/** The office's line: «ڕێککەوتوو $10 · حیسابی سیستەم $5 · قازانج +$5». */
export function agreedPriceView(agreed: string | number | null | undefined, computedUsd: number): AgreedPriceView | null {
  const a = agreedUsd(agreed);
  if (a === null) return null;
  const computed = Math.round((Number(computedUsd) || 0) * 100) / 100;
  return { agreedUsd: a, computedUsd: computed, differenceUsd: Math.round((a - computed) * 100) / 100 };
}
