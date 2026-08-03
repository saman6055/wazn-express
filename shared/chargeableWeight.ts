/**
 * Air freight is sold by the space a parcel occupies, not by what it weighs.
 * A big box of light goods takes the same room on the aircraft as a small
 * heavy one, so every carrier bills the greater of the two figures:
 *
 *     chargeable = max(actual weight, volumetric weight)
 *     volumetric = (L × W × H) / divisor
 *
 * This lived in three places with the divisor hard-coded, and a fourth place
 * — the price written at registration — ignored volumetric weight entirely and
 * billed the actual weight. A 2 kg carton measuring 12 kg by volume was stored
 * at a sixth of what its invoice would later charge, and the customer saw the
 * small number first. One implementation, one divisor, one answer everywhere.
 *
 * Sea is billed on volume outright and never goes through this.
 */

/** IATA's air divisor when centimetres meet kilograms. Configurable per install. */
export const DEFAULT_VOLUMETRIC_DIVISOR = 6000;

export type Dimensions = {
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
};

const n = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const x = parseFloat(String(v));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

/** Volume in cubic metres, or 0 when a side is missing. */
export function volumeCbm(dims: Dimensions): number {
  const l = n(dims.lengthCm), w = n(dims.widthCm), h = n(dims.heightCm);
  if (l === 0 || w === 0 || h === 0) return 0;
  return (l * w * h) / 1_000_000;
}

/** What the dimensions weigh, in the carrier's arithmetic. */
export function volumetricWeightKg(dims: Dimensions, divisor = DEFAULT_VOLUMETRIC_DIVISOR): number {
  const l = n(dims.lengthCm), w = n(dims.widthCm), h = n(dims.heightCm);
  if (l === 0 || w === 0 || h === 0) return 0;
  const d = divisor > 0 ? divisor : DEFAULT_VOLUMETRIC_DIVISOR;
  return (l * w * h) / d;
}

export type ChargeableBreakdown = {
  actualKg: number;
  volumetricKg: number;
  chargeableKg: number;
  /** True when the dimensions, not the scale, decide the price. */
  billedOnVolume: boolean;
  /** chargeable ÷ actual. 1 when they agree; 0 when there is no actual weight. */
  ratio: number;
  /** How much more the customer pays than the scale suggests. */
  extraKg: number;
};

/**
 * The full picture behind one air parcel's price.
 *
 * Sea never calls this: it is billed on volume outright, and running it
 * through a weight comparison would invent a number nobody charges.
 */
export function chargeableWeight(
  input: { weightKg?: string | number | null } & Dimensions,
  divisor = DEFAULT_VOLUMETRIC_DIVISOR,
): ChargeableBreakdown {
  const actualKg = n(input.weightKg);
  const volumetricKg = volumetricWeightKg(input, divisor);
  const chargeableKg = Math.max(actualKg, volumetricKg);

  return {
    actualKg,
    volumetricKg,
    chargeableKg,
    // Ties are not "billed on volume": nothing surprising happened.
    billedOnVolume: volumetricKg > actualKg,
    ratio: actualKg > 0 ? chargeableKg / actualKg : 0,
    extraKg: Math.max(0, chargeableKg - actualKg),
  };
}

/** Parcels are billed by weight on these routes, by volume on sea. */
export function isAirShipping(shippingType: string): boolean {
  return shippingType === 'air_regular' || shippingType === 'air_irregular';
}

/**
 * Is the gap wide enough that somebody has to be told before the invoice?
 *
 * Both a floor and a ratio, because either alone misfires. A ratio alone
 * flags a 0.2 kg envelope measuring 0.6 kg — six times over, and nobody
 * cares about half a kilo. A floor alone flags a genuinely heavy parcel whose
 * volume merely nudges past its weight. Together they catch the case that
 * actually starts an argument: a light box billed like a heavy one.
 */
export function exceedsVolumetricThreshold(
  breakdown: ChargeableBreakdown,
  options: { minExtraKg: number; minRatio: number },
): boolean {
  if (!breakdown.billedOnVolume) return false;
  if (breakdown.actualKg <= 0) return false;
  return breakdown.extraKg >= options.minExtraKg && breakdown.ratio >= options.minRatio;
}
