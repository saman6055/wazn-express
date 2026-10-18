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
  /**
   * The small sea parcel rule for this parcel's owner in its batch
   * (smallParcelPrice). Only a cbm rate reads it.
   */
  smallParcel?: SmallParcelRule | null;
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
    const base = rate > 0 ? rate * cbm : 0;
    return { amountUsd: smallParcelPrice(base, input.smallParcel), quantity: cbm, billedOnVolume: true };
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

// ───────────────────────── small sea parcels, and cartons ─────────────────────────

/**
 * A small sea customer pays more than their share of a cubic metre - worked
 * out by the system, not typed.
 *
 * The owner, 2026-10-18: «بەریدی بچووک کێشە و کولفەی زیاترە», and then: the
 * percent should follow the size - the smaller, the more; nearer the line,
 * the less - set by the system itself, with only a box he can untick to take
 * it off; a tiny parcel worth $1-2 pays at least $5. And, asked whether five
 * small cartons of one person are five small parcels: no - «زۆر بیرۆکەیەکی
 * دادپەروەرانەیە» - what is measured is everything that person has in the
 * batch, and the earlier cartons are put right as later ones arrive.
 *
 * So, for one customer in one sea batch whose rule is on:
 *
 *   percent  = 100 × (0.20 − all their m³) / 0.20, under 0.20 m³; else 0
 *   a parcel = its m³ × the rate × (1 + percent), and never under $5
 *
 * The line was first drawn at 0.25; the owner moved it to 0.20 the same day
 * («لە 0.20 باشترە»). It fades to nothing at the line and never tops 100%,
 * so a customer with more always pays more in all: total = rate × (2T − 5T²)
 * only rises up to T = 0.20. A straight line above 100% would not.
 */
export const SMALL_PARCEL_CBM = 0.2;
export const SMALL_PARCEL_MIN_USD = 5;

export interface SmallParcelRule {
  /** The batch's box is ticked, and the batch is sea. */
  on: boolean;
  /** Everything this customer has in the batch, this parcel included. */
  customerTotalCbm: number;
}

/** The percent for a customer with this much in the batch: 100 at nothing, 0 from the line (SMALL_PARCEL_CBM) up. */
export function smallParcelAutoPercent(customerTotalCbm: number | string | null | undefined): number {
  const t = num(customerTotalCbm);
  return t > 0 && t < SMALL_PARCEL_CBM ? (100 * (SMALL_PARCEL_CBM - t)) / SMALL_PARCEL_CBM : 0;
}

/** A sea parcel's price under the rule, to the cent; the price as it was when the rule is off. */
export function smallParcelPrice(baseUsd: number, rule: SmallParcelRule | null | undefined): number {
  if (!(baseUsd > 0)) return 0;
  if (!rule?.on) return baseUsd;
  const p = smallParcelAutoPercent(rule.customerTotalCbm);
  const priced = Math.round(baseUsd * (100 + p)) / 100;
  return Math.max(priced, SMALL_PARCEL_MIN_USD);
}

/**
 * Cartons of one size under one tracking.
 *
 * The owner, 2026-10-17: in sea Quick Register, the size of one carton is
 * typed once with how many there are. The parcel keeps the one carton's sides
 * and the count, and its volume is all of them together - so every total,
 * price and receipt that reads the volume is already right, and a screen that
 * wants to say "4 cartons x 0.1286" divides by the count.
 *
 * The count multiplies only when it is given: a form that does not know about
 * cartons sends the whole volume, and that is taken as it stands.
 */
export const MAX_CARTONS = 999;

export function cartonCountOf(value: number | string | null | undefined): number {
  const n = Math.floor(num(value));
  return n >= 1 ? Math.min(n, MAX_CARTONS) : 1;
}

export function cartonVolume(input: {
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  volumeCbm?: string | number | null;
  cartonCount?: string | number | null;
}): { perCartonCbm: number; count: number; totalCbm: number } {
  const count = cartonCountOf(input.cartonCount);
  const typed = num(input.volumeCbm);
  const sides = (num(input.lengthCm) * num(input.widthCm) * num(input.heightCm)) / 1_000_000;
  const perCartonCbm = typed > 0 ? typed : sides;
  return { perCartonCbm, count, totalCbm: Math.round(perCartonCbm * count * 1_000_000) / 1_000_000 };
}

/**
 * A sea parcel's volume as a box or a receipt writes it: one carton's volume
 * times the count, then all of them - "4 × 0.129 = 0.514" - or just the
 * volume when it is one carton. The owner, 2026-10-18: in the box it must
 * say that there were four cartons, each one's CBM, and the total.
 */
export function cartonVolumeText(volumeCbm: number | string | null | undefined, cartonCount: number | string | null | undefined, digits = 3): string {
  const total = num(volumeCbm);
  const count = cartonCountOf(cartonCount);
  if (count <= 1 || !(total > 0)) return total.toFixed(digits);
  return `${count} × ${(total / count).toFixed(digits)} = ${total.toFixed(digits)}`;
}
