/**
 * What one parcel costs: a rate, multiplied by the thing that is sold.
 *
 * `resolveBatchRate` decides WHICH rate applies and says, in its own words,
 * that multiplying it by weight or volume "stays where it was". Where it was,
 * it turns out, is four places:
 *
 *   - registration, which multiplies the general route rule
 *   - approving a claim, which multiplies the batch rate
 *   - delivery, which multiplies whichever rate it resolved
 *   - and editing a parcel, which multiplies nothing at all
 *
 * That last one is the fault this was written for. A parcel registered with
 * the weight left at zero — or registered unclaimed, or before its batch had
 * a rate — stores no cost. Somebody notices, opens the parcel, corrects the
 * weight, and the cost stays at $0.00 for ever: the edit wrote the weight and
 * never asked what the weight was for.
 *
 * Three of the four also hard-coded the divisor at 6000, so a warehouse that
 * had changed the setting was billed on the old figure by three paths out of
 * four and the new one by the fourth.
 *
 * So the multiplication lives here, once, beside the rule that picks the
 * rate. It decides an amount from facts it is given; it looks nothing up and
 * charges nobody.
 */

import { chargeableWeight, DEFAULT_VOLUMETRIC_DIVISOR } from "./chargeableWeight";

export interface ParcelCostInput {
  /** The rate that applies, already resolved. 0 means nothing is decided. */
  rate: number;
  /** What that rate is per. Sea sells volume, everything else weight. */
  unit: "kg" | "cbm";
  weightKg?: string | number | null;
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  /** Measured or entered directly; only a cbm rate uses it. */
  volumeCbm?: string | number | null;
  /** The install's air divisor. Defaults to IATA's 6000. */
  divisor?: number;
}

export interface ParcelCost {
  /** 0 when there is nothing honest to charge — never a guess. */
  amountUsd: number;
  /** Kilos or cubic metres, whichever the rate is per. */
  quantity: number;
  /** True when the dimensions, not the scale, set the price. */
  billedOnVolume: boolean;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

/**
 * The amount, and what it was worked out from.
 *
 * Returns zero rather than a guess whenever a fact is missing — no rate, no
 * weight, no measurement. Zero here means "not known yet", and the callers
 * are written to leave a stored figure alone when they get it, rather than
 * overwriting a real price with a blank.
 */
export function parcelCost(input: ParcelCostInput): ParcelCost {
  const rate = num(input.rate);

  if (input.unit === "cbm") {
    const cbm = num(input.volumeCbm);
    return { amountUsd: rate > 0 ? rate * cbm : 0, quantity: cbm, billedOnVolume: true };
  }

  // Air sells the space a parcel occupies, so the greater of the two weights
  // is what any carrier bills — and what our own invoice will bill later.
  const breakdown = chargeableWeight(input, input.divisor || DEFAULT_VOLUMETRIC_DIVISOR);
  return {
    amountUsd: rate > 0 ? rate * breakdown.chargeableKg : 0,
    quantity: breakdown.chargeableKg,
    billedOnVolume: breakdown.billedOnVolume,
  };
}

/**
 * The stored figure, as a string, or undefined to mean "leave it alone".
 *
 * The distinction matters on edit. Correcting a description must not wipe a
 * price that was worked out properly, so a cost of zero is never written over
 * one that already exists.
 */
export function parcelCostUsd(input: ParcelCostInput): string | undefined {
  const { amountUsd } = parcelCost(input);
  return amountUsd > 0 ? amountUsd.toFixed(2) : undefined;
}

/**
 * Does this edit change what the parcel costs?
 *
 * Only these fields feed the price. Editing a description or a photo must not
 * send the system back to the pricing tables, and — more to the point — must
 * not reprice a parcel behind somebody's back.
 */
export const COST_BEARING_FIELDS = [
  "weightKg",
  "lengthCm",
  "widthCm",
  "heightCm",
  "volumeCbm",
  "shippingType",
  "batchId",
  "customerId",
] as const;

export function affectsCost(changed: Record<string, unknown>): boolean {
  return COST_BEARING_FIELDS.some((f) => changed[f] !== undefined);
}
