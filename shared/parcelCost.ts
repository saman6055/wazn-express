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
  /** A volumetric discount: the kilos charged (shared/chargeableWeight). Air only. */
  billedWeightKg?: string | number | null;
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
 * A small sea parcel pays more than its share of a cubic metre - worked out by
 * the system, not typed.
 *
 * The owner, 2026-10-18: «بەریدی بچووک کێشە و کولفەی زیاترە»; the percent
 * follows the size - the smaller, the more; nearer the line, the less; a tiny
 * parcel worth $1-2 pays at least $5. The line was drawn at 0.20 m³.
 *
 * 2026-11-07 (owner approved: «زۆر دروست پێم وایە... هەمووی هەماهەنگ بێت»):
 * what is measured is the PARCEL ITSELF - one tracking with all its cartons
 * (volumeCbm already holds them all) - not everything its owner has in the
 * batch. A parcel at or over the line never has the extra, whatever else the
 * same person sent. The office can take it off one parcel («بێ زیادە»).
 *
 *   percent  = 100 × (0.20 − its m³) / 0.20, under 0.20 m³; else 0
 *   a parcel = its m³ × the rate × (1 + percent), and never under $5
 *
 * It fades to nothing at the line and never tops 100%.
 */
export const SMALL_PARCEL_CBM = 0.2;
export const SMALL_PARCEL_MIN_USD = 5;

export interface SmallParcelRule {
  /** The batch's box is ticked, and the batch is sea. */
  on: boolean;
  /** This parcel's own volume: every carton under its one tracking. */
  parcelCbm: number | string | null | undefined;
  /** The office took the extra off this one parcel. */
  waived?: boolean | null;
}

/** The percent for a parcel of this size: 100 at nothing, 0 from the line (SMALL_PARCEL_CBM) up. */
export function smallParcelAutoPercent(parcelCbm: number | string | null | undefined): number {
  const t = num(parcelCbm);
  return t > 0 && t < SMALL_PARCEL_CBM ? (100 * (SMALL_PARCEL_CBM - t)) / SMALL_PARCEL_CBM : 0;
}

/**
 * The parcel's price under the rule, and how it got there - the office's view
 * (the customer is shown only finalUsd: no word "extra", no percent, no base).
 */
export interface SmallParcelBreakdown {
  /** The plain price: m³ × rate. */
  baseUsd: number;
  /** What is charged. */
  finalUsd: number;
  /** The percent added, rounded for showing; 0 when none. */
  percent: number;
  /** finalUsd − baseUsd: what the rule collected on this parcel. */
  extraUsd: number;
  /** The $5 least decided the price. */
  minimum: boolean;
  /** The parcel is under the line in a batch with the rule on (charged or waived). */
  eligible: boolean;
  /** Eligible, and the office took the extra off. */
  waived: boolean;
}

export function smallParcelBreakdown(baseUsd: number, rule: SmallParcelRule | null | undefined): SmallParcelBreakdown {
  const base = baseUsd > 0 ? Math.round(baseUsd * 100) / 100 : 0;
  const plain: SmallParcelBreakdown = { baseUsd: base, finalUsd: base, percent: 0, extraUsd: 0, minimum: false, eligible: false, waived: false };
  if (!(baseUsd > 0) || !rule?.on) return plain;
  const p = smallParcelAutoPercent(rule.parcelCbm);
  if (!(p > 0)) return plain;
  if (rule.waived) return { ...plain, eligible: true, waived: true };
  const priced = Math.round(baseUsd * (100 + p)) / 100;
  const finalUsd = Math.max(priced, SMALL_PARCEL_MIN_USD);
  return {
    baseUsd: base,
    finalUsd,
    percent: Math.round(p),
    extraUsd: Math.round((finalUsd - base) * 100) / 100,
    minimum: finalUsd === SMALL_PARCEL_MIN_USD && priced < SMALL_PARCEL_MIN_USD,
    eligible: true,
    waived: false,
  };
}

/** A sea parcel's price under the rule, to the cent; the price as it was when the rule is off or waived. */
export function smallParcelPrice(baseUsd: number, rule: SmallParcelRule | null | undefined): number {
  if (!(baseUsd > 0)) return 0;
  const b = smallParcelBreakdown(baseUsd, rule);
  return b.eligible ? b.finalUsd : baseUsd;
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

/**
 * Several cartons of one size under one tracking: the sides and the weight
 * typed are ONE carton's, and the parcel is all of them.
 *
 * The volume is always all of them (sea since 2026-10-17; air since the
 * owner, 2026-10-21: «ئەبێ کە کرتە دوو دانە یا زیاتر کیلۆ و یا ئەگەر کێشی
 * قەبارەیی بوو دووقاتی بکاتەوە نرخی گواستنەوەکەش دووقات ببتەوە»). On air the
 * weight is all of them too, so the chargeable kilos - the greater of the
 * scale and the volume - and the price follow the count. Sea is sold by the
 * cubic metre; its weight stays as typed, as before.
 *
 * The totals are what is stored on the parcel, so every price, report, box
 * and receipt that reads the parcel is right without being told.
 */
export function cartonsMultiplyWeight(shippingType: string | null | undefined): boolean {
  return shippingType === "air_regular" || shippingType === "air_irregular";
}

/** One carton's typed weight, times the count on air; as typed otherwise (or for one carton). */
export function cartonWeightTotal(
  weightKg: string | number | null | undefined,
  cartonCount: string | number | null | undefined,
  shippingType: string | null | undefined,
): string | undefined {
  if (weightKg === null || weightKg === undefined || weightKg === "") return undefined;
  const count = cartonCountOf(cartonCount);
  const per = num(weightKg);
  if (count <= 1 || !(per > 0) || !cartonsMultiplyWeight(shippingType)) return String(weightKg);
  return (Math.round(per * count * 1000) / 1000).toFixed(3);
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
