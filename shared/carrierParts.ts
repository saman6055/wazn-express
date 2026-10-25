/**
 * A carrier's bill that covers only part of a batch (owner, 2026-10-25).
 *
 * A batch made in China carries the weight registered there - AIR-2026-069GZ:
 * 182 parcels, 233.35 kg - and the carrier may deliver it in two or three
 * loads, each with its own invoice. With only the first invoice typed (74 kg)
 * the batch read "they billed 159 kg less: +$1,402 extra profit", which is
 * the rest of the goods still on the road, not profit.
 *
 * His rule for when a bill is "part of the batch only": the carrier billed
 * less than 90% of our weight, or 15 kg or more under it - a carton is about
 * 20 kg, so 15 kg missing is a carton missing. Small gaps are ordinary and
 * the batch is reckoned as it always was.
 *
 * While a bill looks partial the batch's profit waits for the other loads.
 * An admin who knows the reason ("they lost a carton", "we sent it on a
 * later batch") may say so, and the batch stops waiting.
 *
 * Air only: the owner set the rule in kilograms. A sea batch is reckoned as
 * before.
 */

/** Less than this share of our weight is a partial bill. */
export const PARTIAL_BILL_SHARE = 0.9;
/** This many kilograms or more under our weight is a partial bill. */
export const PARTIAL_BILL_GAP_KG = 15;

export interface CarrierPartsFacts {
  shippingType: string | null | undefined;
  /** Our weight: every parcel on the batch, as charged (the "space" kilos). */
  oursKg: number;
  /** What the carrier billed so far - the sum of its invoices. */
  carrierKg: number;
  /** An admin said it should not wait. */
  accepted: boolean;
}

export type CarrierPartsVerdict =
  /** Nothing to judge: sea, no bill yet, or no weight of ours. */
  | "none"
  /** The bill is close to our weight. */
  | "whole"
  /** Far under our weight: more loads expected, profit waits. */
  | "partial"
  /** Far under, but an admin said why and that it should not wait. */
  | "accepted";

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** True when the carrier billed far less than our weight. */
export function billLooksPartial(oursKg: number, carrierKg: number): boolean {
  const ours = pos(oursKg);
  const carrier = pos(carrierKg);
  if (!(ours > 0) || !(carrier > 0)) return false;
  const gap = ours - carrier;
  if (!(gap > 0)) return false;
  return carrier < ours * PARTIAL_BILL_SHARE || gap >= PARTIAL_BILL_GAP_KG - 1e-9;
}

export function carrierPartsVerdict(f: CarrierPartsFacts): CarrierPartsVerdict {
  if (f.shippingType === "sea") return "none";
  if (!(pos(f.carrierKg) > 0) || !(pos(f.oursKg) > 0)) return "none";
  if (!billLooksPartial(f.oursKg, f.carrierKg)) return "whole";
  return f.accepted ? "accepted" : "partial";
}

/** Profit waits only while the verdict is "partial". */
export function profitWaitsForParts(verdict: CarrierPartsVerdict): boolean {
  return verdict === "partial";
}

export interface CarrierPartLike {
  billedKg?: string | number | null;
  billedCbm?: string | number | null;
  costUsd?: string | number | null;
}

const num = (v: string | number | null | undefined) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * What the batch holds once it has loads: the billed weight, volume and cost
 * are their sums. A figure no load carries stays null - the batch's own field
 * is cleared rather than kept at a number no invoice says.
 */
export function sumCarrierParts(parts: CarrierPartLike[]): { billedKg: string | null; billedCbm: string | null; costUsd: string | null } {
  const kg = parts.reduce((s, p) => s + num(p.billedKg), 0);
  const cbm = parts.reduce((s, p) => s + num(p.billedCbm), 0);
  const cost = parts.reduce((s, p) => s + num(p.costUsd), 0);
  return {
    billedKg: kg > 0 ? round(kg, 2).toFixed(2) : null,
    billedCbm: cbm > 0 ? round(cbm, 4).toFixed(4) : null,
    costUsd: cost > 0 ? round(cost, 2).toFixed(2) : null,
  };
}
