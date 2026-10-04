/**
 * Numbers on a parcel that are not logical (owner, 2026-10-04, the same rule
 * as shared/batchNumberSense). UNC-000001 was registered at 224 kg and
 * UNC-000002 at 454 kg — $8,136 of freight on two parcels nobody had — and
 * nothing asked. A question, never a refusal: the number may be true.
 *
 * The limits are generous on purpose. A carton from China is almost always
 * under 30 kg and a metre a side; these only catch a slipped digit.
 */

import { volumeCbm, volumetricWeightKg, DEFAULT_VOLUMETRIC_DIVISOR, type Dimensions } from "./chargeableWeight";

export const PARCEL_MAX_KG = 100;
export const PARCEL_MAX_SIDE_CM = 200;
export const PARCEL_MAX_CBM = 2;

const n = (v: unknown) => {
  const x = parseFloat(String(v ?? ""));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

export interface ParcelNumbers extends Dimensions {
  weightKg?: string | number | null;
}

/** Each line in plain Sorani; empty when nothing is odd. */
export function oddParcelNumbers(p: ParcelNumbers, divisor = DEFAULT_VOLUMETRIC_DIVISOR): string[] {
  const out: string[] = [];
  const kg = n(p.weightKg);
  if (kg > PARCEL_MAX_KG) out.push(`کێشی ${kg} کیلۆیە — پاکەتێک ئاسایی لە ${PARCEL_MAX_KG} کیلۆ کەمترە.`);
  for (const [label, side] of [["درێژی", p.lengthCm], ["پانی", p.widthCm], ["بەرزی", p.heightCm]] as const) {
    const cm = n(side);
    if (cm > PARCEL_MAX_SIDE_CM) out.push(`${label} ${cm} سم ـە — لەوانەیە ملیمەتر بێت نەک سانتیمەتر.`);
  }
  const cbm = volumeCbm(p);
  if (cbm > PARCEL_MAX_CBM) out.push(`قەبارەی ${cbm.toFixed(3)} CBM ـە — زۆر گەورەترە لە پاکەتێکی ئاسایی.`);
  const vol = volumetricWeightKg(p, divisor);
  if (kg > 0 && vol > 50 && vol > kg * 10) {
    out.push(`کێشی قەبارەیی ${vol.toFixed(1)} کیلۆیە بەرامبەر ${kg} کیلۆی تەرازوو — پێوانەکان بپشکنە.`);
  }
  return out;
}

/** The question shown before saving. */
export function oddParcelQuestion(lines: readonly string[]): string {
  return `ئەم ژمارانە لۆجیکی نین:\n\n${lines.map((l) => `• ${l}`).join("\n")}\n\nتکایە دووبارە دڵنیا بەرەوە.`;
}
