/**
 * Volumetric parcels, counted (owner, 2026-10-23).
 *
 * "In the whole system there was no place and no report to know the
 * volumetric weights - very important for me": per batch, per box, per
 * customer, for the office only, never the customer. And per batch, against
 * the carrier: what did we charge our customers for volume beyond the scale,
 * what did the carrier charge us for it, and what is left for us.
 *
 * Example. A batch whose parcels weigh 400 kg on the scale and 520 kg by
 * volume: 120 kg of volume the customers paid for, at $10 = $1,200. The
 * carrier billed 450 kg against a real 400: 50 kg at $6 = $300. Left for us:
 * $900, less whatever discount was given on the volume.
 *
 * Pure figures here; the database side is server/db/volumetricReport.db.ts.
 */
import { chargeableWeight, DEFAULT_VOLUMETRIC_DIVISOR } from "./chargeableWeight";

export interface VolumetricParcelFacts {
  weightKg?: string | number | null;
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  volumeCbm?: string | number | null;
  billedWeightKg?: string | number | null;
  calculatedCostUsd?: string | number | null;
}

export interface VolumetricFigures {
  parcels: number;
  /** Parcels whose volume weighs more than their scale. */
  volumetricParcels: number;
  actualKg: number;
  /** The greater of scale and volume, parcel by parcel - before any discount. */
  volumeKg: number;
  /** What was charged, a volumetric discount included. */
  chargedKg: number;
  /** volume − scale: the kilos the size added. */
  extraKg: number;
  discountKg: number;
  /** What customers paid for kilos beyond the scale, after discounts. */
  paidForVolumeUsd: number;
  discountUsd: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const num = (v: unknown) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};

export const NO_FIGURES: VolumetricFigures = {
  parcels: 0, volumetricParcels: 0, actualKg: 0, volumeKg: 0, chargedKg: 0,
  extraKg: 0, discountKg: 0, paidForVolumeUsd: 0, discountUsd: 0,
};

/**
 * One air parcel. The rate is the parcel's own price over its kilos charged
 * (its customer's agreed rate, whatever it was); a parcel with no price yet
 * falls back to the rate given (its batch's).
 */
export function volumetricOf(p: VolumetricParcelFacts, divisor = DEFAULT_VOLUMETRIC_DIVISOR, fallbackRate = 0): VolumetricFigures {
  const w = chargeableWeight(p, divisor);
  const cost = num(p.calculatedCostUsd);
  const rate = cost > 0 && w.chargeableKg > 0 ? cost / w.chargeableKg : fallbackRate;
  const full = w.fullKg ?? w.chargeableKg;
  const discountKg = w.discountKg ?? 0;
  const byVolume = w.volumetricKg > w.actualKg;
  return {
    parcels: 1,
    volumetricParcels: byVolume ? 1 : 0,
    actualKg: w.actualKg,
    volumeKg: full,
    chargedKg: w.chargeableKg,
    extraKg: Math.max(0, full - w.actualKg),
    discountKg,
    paidForVolumeUsd: Math.max(0, w.chargeableKg - w.actualKg) * rate,
    discountUsd: discountKg * rate,
  };
}

export function addFigures(a: VolumetricFigures, b: VolumetricFigures): VolumetricFigures {
  return {
    parcels: a.parcels + b.parcels,
    volumetricParcels: a.volumetricParcels + b.volumetricParcels,
    actualKg: a.actualKg + b.actualKg,
    volumeKg: a.volumeKg + b.volumeKg,
    chargedKg: a.chargedKg + b.chargedKg,
    extraKg: a.extraKg + b.extraKg,
    discountKg: a.discountKg + b.discountKg,
    paidForVolumeUsd: a.paidForVolumeUsd + b.paidForVolumeUsd,
    discountUsd: a.discountUsd + b.discountUsd,
  };
}

export function roundFigures(f: VolumetricFigures): VolumetricFigures {
  return {
    ...f,
    actualKg: round3(f.actualKg), volumeKg: round3(f.volumeKg), chargedKg: round3(f.chargedKg),
    extraKg: round3(f.extraKg), discountKg: round3(f.discountKg),
    paidForVolumeUsd: round2(f.paidForVolumeUsd), discountUsd: round2(f.discountUsd),
  };
}

export interface CarrierVolumetric {
  /** The carrier's real weight - as typed on the batch, else ours from the scale. */
  actualKg: number;
  actualFromBatch: boolean;
  /** What the carrier billed, as typed on the batch; null while not typed. */
  chargedKg: number | null;
  /** charged − real: the volume the carrier charged us for. Null while unknown. */
  extraKg: number | null;
  /** The batch's real cost per kilo (shared/batchCost); 0 while unknown. */
  costPerKg: number;
  /** What the carrier's volume cost us. Null while unknown. */
  extraCostUsd: number | null;
  /** What customers paid for volume, less what the carrier charged for it. Null while unknown. */
  leftForUsUsd: number | null;
}

/** The batch against its carrier, from the two figures typed on the batch. */
export function carrierVolumetric(
  ours: VolumetricFigures,
  batch: { actualWeightKg?: string | number | null; chargedWeightKg?: string | number | null },
  costPerKg: number,
): CarrierVolumetric {
  const typedActual = num(batch.actualWeightKg);
  const actualKg = typedActual > 0 ? typedActual : ours.actualKg;
  const typedCharged = num(batch.chargedWeightKg);
  const chargedKg = typedCharged > 0 ? typedCharged : null;
  const extraKg = chargedKg === null ? null : Math.max(0, chargedKg - actualKg);
  const extraCostUsd = extraKg === null || !(costPerKg > 0) ? null : round2(extraKg * costPerKg);
  return {
    actualKg: round3(actualKg),
    actualFromBatch: typedActual > 0,
    chargedKg: chargedKg === null ? null : round3(chargedKg),
    extraKg: extraKg === null ? null : round3(extraKg),
    costPerKg: round2(costPerKg),
    extraCostUsd,
    leftForUsUsd: extraCostUsd === null ? null : round2(ours.paidForVolumeUsd - extraCostUsd),
  };
}
