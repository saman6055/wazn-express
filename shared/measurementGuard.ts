/**
 * A parcel may not be stored without the measurements it will be billed on.
 *
 * A registration with no weight and no volume cannot be priced, cannot be put
 * in a batch, and cannot be invoiced. It used to be accepted anyway, and the
 * gap was found weeks later — by which time the box is deep in a pile in the
 * China warehouse and nobody can go back and weigh it. Refusing at the counter
 * costs one minute; refusing later costs a parcel nobody can charge for.
 *
 * What counts as measured depends on how it ships:
 *
 *   - Sea is billed by volume, so volume is what it must have.
 *   - Air is billed by chargeable weight — the greater of actual weight and
 *     volumetric weight — so it needs the actual weight, and dimensions too,
 *     since without them the volumetric side of that comparison is missing and
 *     a light bulky carton silently bills as though it were small.
 */

export type MeasurementInput = {
  shippingType: 'air_regular' | 'air_irregular' | 'sea';
  weightKg?: string | number | null;
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  volumeCbm?: string | number | null;
};

export type MissingMeasurement = 'weight' | 'volume' | 'dimensions';

const toNumber = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * What this parcel still needs before it can be stored, in the order a person
 * would fill it in. Empty means it is ready.
 */
export function missingMeasurements(input: MeasurementInput): MissingMeasurement[] {
  const weight = toNumber(input.weightKg);
  const cbm = toNumber(input.volumeCbm);
  const hasDims =
    toNumber(input.lengthCm) > 0 && toNumber(input.widthCm) > 0 && toNumber(input.heightCm) > 0;

  const missing: MissingMeasurement[] = [];

  if (input.shippingType === 'sea') {
    // Volume can be typed straight in or derived from the sides; either does.
    if (cbm === 0 && !hasDims) missing.push('volume');
    return missing;
  }

  if (weight === 0) missing.push('weight');
  // Dimensions may be skipped if the volume is already known some other way.
  if (!hasDims && cbm === 0) missing.push('dimensions');
  return missing;
}

/** Convenience for call sites that only care whether to let the save through. */
export function isMeasured(input: MeasurementInput): boolean {
  return missingMeasurements(input).length === 0;
}

/** Bilingual message naming exactly what is missing, for the operator. */
export function missingMeasurementMessage(missing: MissingMeasurement[]): string {
  const ku: Record<MissingMeasurement, string> = {
    weight: 'کێش',
    volume: 'قەبارە (CBM یان درێژی×پانی×بەرزی)',
    dimensions: 'دووری (درێژی×پانی×بەرزی)',
  };
  const en: Record<MissingMeasurement, string> = {
    weight: 'weight',
    volume: 'volume (CBM or L×W×H)',
    dimensions: 'dimensions (L×W×H)',
  };
  return (
    `ناتوانرێت تۆمار بکرێت بەبێ ${missing.map((m) => ku[m]).join(' و ')} — ` +
    `بەبێ ئەمە نرخی بۆ دانانرێت و ناخرێتە باچەوە | ` +
    `Cannot register without ${missing.map((m) => en[m]).join(' and ')} — ` +
    `it cannot be priced or batched`
  );
}
