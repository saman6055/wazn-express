import { chargeableWeight, DEFAULT_VOLUMETRIC_DIVISOR } from "./chargeableWeight";

/**
 * A shipping quote, worked the way the customer's calculator in the portal
 * works it (PriceListSection's PriceCalculator) and the way the invoice
 * charges it — so the office can try a carton and a divisor in the Portal
 * Center before saving them (owner, 2026-09-18, phase 5).
 *
 *   • Air: the larger of the scale and L×W×H ÷ divisor (shared
 *     chargeableWeight), times the rate per kg.
 *   • Sea: the volume, L×W×H ÷ 1,000,000 or typed directly, times the rate
 *     per m³.
 *
 * Nothing else. The minimum kg and the sea surcharge in the calculator
 * settings are applied by no charge on the server, so a quote that used them
 * would not be the invoice. Pure: no database.
 */

export type QuoteShippingType = "air_regular" | "air_irregular" | "sea";

export interface ShippingQuote {
  unit: "kg" | "cbm";
  actualKg: number;
  volumetricKg: number;
  chargeableKg: number;
  /** Air: billed on its size rather than the scale. */
  billedOnVolume: boolean;
  cbm: number;
  total: number;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
};

export function quoteShipping(
  input: {
    shippingType: QuoteShippingType;
    pricePerUnit: number | string | null | undefined;
    weightKg?: number | string | null;
    lengthCm?: number | string | null;
    widthCm?: number | string | null;
    heightCm?: number | string | null;
    /** Sea: the volume typed directly, in place of the sizes. */
    cbm?: number | string | null;
  },
  divisor: number = DEFAULT_VOLUMETRIC_DIVISOR,
): ShippingQuote {
  const price = n(input.pricePerUnit);
  const L = n(input.lengthCm);
  const W = n(input.widthCm);
  const H = n(input.heightCm);

  if (input.shippingType === "sea") {
    const cbm = n(input.cbm) > 0 ? n(input.cbm) : L > 0 && W > 0 && H > 0 ? (L * W * H) / 1_000_000 : 0;
    return { unit: "cbm", actualKg: n(input.weightKg), volumetricKg: 0, chargeableKg: 0, billedOnVolume: false, cbm, total: cbm * price };
  }

  const air = chargeableWeight({ weightKg: n(input.weightKg), lengthCm: L, widthCm: W, heightCm: H }, n(divisor) || DEFAULT_VOLUMETRIC_DIVISOR);
  return {
    unit: "kg",
    actualKg: air.actualKg,
    volumetricKg: air.volumetricKg,
    chargeableKg: air.chargeableKg,
    billedOnVolume: air.billedOnVolume,
    cbm: L > 0 && W > 0 && H > 0 ? (L * W * H) / 1_000_000 : 0,
    total: air.chargeableKg * price,
  };
}
