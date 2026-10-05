/**
 * What one shipment cost the company, from whichever number was recorded.
 *
 * The office knows the cost of a batch in one of two shapes. Sometimes the
 * carrier quotes a rate — $7.00 per kg — and that is what gets typed. Just as
 * often the carrier's invoice arrives as one figure for the whole shipment —
 * $2,000 — days after the batch was created, and nobody sits down to divide
 * it. The total was stored (`batches.shippingCost`) and then read by nothing:
 * every profit figure multiplied the per-unit rate, so a batch recorded only
 * by its total showed a cost of zero and a profit that was pure fiction.
 *
 * One rule, asked by everything that needs a cost:
 *
 *   1. The carrier's total wins. It is the money that actually left the
 *      company — the freight and every extra service on the same invoice —
 *      and the real cost of a kilo is that total divided over the billed
 *      base. A per-unit rate typed beside it is not read.
 *   2. No total recorded: the per-unit rate × the billed base.
 *   3. Neither recorded — the cost is honestly zero, and `source` says so,
 *      so a screen can show "تێچوو تۆمار نەکراوە" instead of a confident 0.
 *
 * It was the other way round until 2026-10-05: the rate won, "the more
 * deliberate entry". The owner, that day: «ئەگەر هەم نرخی کیلۆ و هەم کۆی
 * پسووڵە نووسرابن، کۆی پسووڵە وەرگرێ، ئەوەی تر پشتگوێ بخات — دەقیقتر ئەبێ».
 * A rate is what the carrier quoted; the invoice is what the carrier was
 * paid, and it carries the charges no quote has in it. With the rate
 * winning, a $2,400 invoice on 300 kg quoted at $7 was costed at $2,100 and
 * $300 of real cost appeared in every report as profit.
 *
 * The typed rate is never overwritten — the result says what it was
 * (`ignoredRate`) so the screen can show both and nobody has to wonder
 * which one counted.
 *
 * Air batches divide over chargeable kilograms, sea over CBM — the same
 * bases the customer side already bills in.
 */

export type BatchCostSource = "rate" | "total" | "none";

export interface BatchCostInputs {
  shippingType?: string | null;
  /** Explicit per-unit rates, as stored (decimal strings or numbers). */
  costPerKg?: string | number | null;
  costPerCbm?: string | number | null;
  /** The carrier's one figure for the whole shipment. */
  shippingCost?: string | number | null;
  /** Billed base for an air batch: chargeable kilograms. */
  chargeableKg?: number;
  /** Billed base for a sea batch: cubic meters. */
  totalCbm?: number;
}

export interface BatchCostResult {
  totalCostUsd: number;
  /** The REAL cost per kg (air) or per CBM (sea). 0 when it cannot be known yet. */
  effectiveRate: number;
  unit: "kg" | "cbm";
  source: BatchCostSource;
  /**
   * A per-unit rate somebody typed that was NOT used, because the carrier's
   * total decided. 0 when no rate was typed or the rate is what was used.
   */
  ignoredRate: number;
}

const positive = (value: string | number | null | undefined): number => {
  const n = parseFloat(String(value ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * What the carrier's rate multiplies — one answer for every screen.
 *
 * Owner, 2026-10-04: "profit and loss on the basis of OUR weight — the weight
 * and size measured tracking by tracking at registration, the same weight the
 * customer paid on. If the carrier's billed weight is there, cost is worked
 * from that and compared with ours; if not, cost and sale both stand on ours."
 *
 *   1. the weight (or volume) the carrier billed — typed from its invoice;
 *   2. otherwise OUR billed weight: the sum, parcel by parcel, of what we
 *      charged the customer on (scale weight or volume weight, whichever is
 *      more; for sea, the volume).
 *
 * The batch's hand-typed "actual weight" is no longer part of it: our weight
 * is counted from the parcels themselves, so it cannot be mistyped and moves
 * by itself as trackings come and go.
 */
export function carrierCostBase(
  shippingType: string | null | undefined,
  batch: { chargedWeightKg?: string | number | null; chargedCbm?: string | number | null },
  ours: { billedKg: number; cbm: number },
): number {
  return isSeaCost(shippingType)
    ? positive(batch.chargedCbm) || Math.max(0, ours.cbm)
    : positive(batch.chargedWeightKg) || Math.max(0, ours.billedKg);
}

/**
 * Ours against the carrier's, for the line under the cost: positive when the
 * carrier billed less than we charged on — that is extra profit — negative
 * when it billed more. Null until both are known and there is a rate.
 */
export function carrierDifference(
  shippingType: string | null | undefined,
  batch: { chargedWeightKg?: string | number | null; chargedCbm?: string | number | null; costPerKg?: string | number | null; costPerCbm?: string | number | null; shippingCost?: string | number | null },
  ours: { billedKg: number; cbm: number },
): { ours: number; carrier: number; units: number; usd: number; unit: "kg" | "cbm" } | null {
  const sea = isSeaCost(shippingType);
  const carrier = positive(sea ? batch.chargedCbm : batch.chargedWeightKg);
  const own = sea ? ours.cbm : ours.billedKg;
  if (!(carrier > 0) || !(own > 0)) return null;
  // The same order as resolveBatchCost: the carrier's total over what it
  // billed is the real rate; a typed rate only when there is no total.
  const rate = positive(batch.shippingCost) / carrier || positive(sea ? batch.costPerCbm : batch.costPerKg);
  if (!(rate > 0)) return null;
  const units = own - carrier;
  return { ours: own, carrier, units, usd: Math.round(units * rate * 100) / 100, unit: sea ? "cbm" : "kg" };
}

/** Each parcel's volume, as the SQL reads it: the volume given, else its three sides. */
const PARCEL_CBM_SQL = `COALESCE(NULLIF(CAST(COALESCE(p.volumeCbm, 0) AS DECIMAL(12,6)), 0),
  CAST(COALESCE(p.lengthCm, 0) AS DECIMAL(12,2)) * CAST(COALESCE(p.widthCm, 0) AS DECIMAL(12,2)) * CAST(COALESCE(p.heightCm, 0) AS DECIMAL(12,2)) / 1000000)`;

/**
 * The same rule in SQL, for the reports that read many batches at once.
 * `divisor` is the volumetric divisor in force (settings), so the SQL and
 * shared/chargeableWeight bill the same kilo.
 */
export function carrierBaseKgSql(divisor: number): string {
  const d = divisor > 0 ? Math.round(divisor) : 6000;
  return `COALESCE(
  NULLIF(CAST(COALESCE(batches.chargedWeightKg, 0) AS DECIMAL(12,2)), 0),
  (SELECT COALESCE(SUM(GREATEST(CAST(COALESCE(p.weightKg, 0) AS DECIMAL(12,3)), (${PARCEL_CBM_SQL}) * 1000000 / ${d})), 0)
     FROM packages p WHERE p.batchId = batches.id))`;
}
export const CARRIER_BASE_CBM_SQL = `COALESCE(
  NULLIF(CAST(COALESCE(batches.chargedCbm, 0) AS DECIMAL(12,4)), 0),
  (SELECT COALESCE(SUM(${PARCEL_CBM_SQL}), 0) FROM packages p WHERE p.batchId = batches.id))`;

export function isSeaCost(shippingType?: string | null): boolean {
  return shippingType === "sea";
}

export function resolveBatchCost(inputs: BatchCostInputs): BatchCostResult {
  const sea = isSeaCost(inputs.shippingType);
  const unit = sea ? ("cbm" as const) : ("kg" as const);
  const base = sea ? inputs.totalCbm ?? 0 : inputs.chargeableKg ?? 0;
  const rate = sea ? positive(inputs.costPerCbm) : positive(inputs.costPerKg);
  const total = positive(inputs.shippingCost);

  // 1. What the carrier was paid. With no billed base yet the total is still
  //    the true cost — the per-unit rate just waits for the weights.
  if (total > 0) {
    return {
      totalCostUsd: total,
      effectiveRate: base > 0 ? total / base : 0,
      unit,
      source: "total",
      ignoredRate: rate,
    };
  }
  // 2. A quoted rate needs its weight. With no billed base yet, rate × 0
  //    said the batch cost nothing and every dollar of its freight looked
  //    like profit (found 2026-10-03 on AIR-2026-035, -043, -046, -047,
  //    -056, -059, -060 and SEA-068).
  if (rate > 0 && base > 0) {
    return { totalCostUsd: rate * base, effectiveRate: rate, unit, source: "rate", ignoredRate: 0 };
  }
  // A rate is known but not yet what it multiplies: the cost is honestly
  // not known yet, which "none" says.
  return { totalCostUsd: 0, effectiveRate: rate, unit, source: "none", ignoredRate: 0 };
}

/**
 * The per-unit rate to write back once the shipment's billed base is known —
 * the "divide the $2,000 over the kilos" step, run when the batch is
 * delivered and the weights are final.
 *
 * Null when there is nothing to derive: a rate is already set, no total was
 * recorded, or the base is still zero. Rounded to cents because the column
 * holds two decimals; the total itself stays the exact figure, so reports
 * that want the true cost read the total, not rate × base.
 *
 * "A rate is already set" is asked outright. A total now decides the cost
 * even beside a typed rate, so "the total decided" no longer means the rate
 * box is empty — and a figure somebody typed is never written over.
 */
export function deriveCostRate(inputs: BatchCostInputs): number | null {
  const typed = isSeaCost(inputs.shippingType) ? positive(inputs.costPerCbm) : positive(inputs.costPerKg);
  if (typed > 0) return null;
  const resolved = resolveBatchCost(inputs);
  if (resolved.source !== "total" || resolved.effectiveRate <= 0) return null;
  return Math.round(resolved.effectiveRate * 100) / 100;
}

export interface BatchCostWords {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

export interface BatchCostWorking {
  /** What decided the cost, in words. */
  label: BatchCostWords;
  /** The arithmetic, to be drawn left to right. Null when there is none. */
  math: string | null;
  /** A typed per-unit rate that did not count ("$7.00/kg"). Null when none. */
  ignored: string | null;
}

/** Said before a typed rate that did not count. */
export const IGNORED_RATE_WORDS: BatchCostWords = {
  ku: "نرخی نووسراو حیساب نەکرا:",
  en: "typed rate, not counted:",
  ar: "السعر المكتوب لم يُحتسب:",
  zh: "填写的单价未计入：",
};

const money = (n: number): string => `$${n.toFixed(2)}`;
const measure = (n: number, unit: "kg" | "cbm"): string =>
  unit === "cbm" ? `${n.toFixed(3)} CBM` : `${n.toFixed(2)} kg`;

/**
 * Where the cost came from, as the arithmetic that produced it.
 *
 * One answer for every screen that shows a batch's cost, so the figure
 * explains itself the same way everywhere: the invoice divided over the
 * kilos, or the rate times them. When a rate was typed beside a total it is
 * named as not counted — otherwise the two numbers on the batch disagree and
 * nothing says which one the profit was worked from.
 *
 * The words and the arithmetic come apart on purpose. A line of Kurdish with
 * "$2,400.00 ÷ 300.00 kg = $8.00/kg" inside it is reordered by the screen —
 * the numbers change places around the signs — so the arithmetic is handed
 * over whole, to be drawn left to right in its own span.
 *
 * `base` is what the rate multiplies or the total is divided over
 * (carrierCostBase).
 */
export function batchCostWorking(cost: BatchCostResult, base: number): BatchCostWorking {
  const unit = cost.unit === "cbm" ? "CBM" : "kg";
  if (cost.source === "none") {
    return {
      label: { ku: "تێچوو تۆمار نەکراوە", en: "No cost recorded", ar: "لم تُسجَّل التكلفة", zh: "未记录成本" },
      math: null,
      ignored: null,
    };
  }
  if (cost.source === "rate") {
    return {
      label: { ku: "نرخی یەکە × کێشی حیسابکراو", en: "Rate × billed weight", ar: "سعر الوحدة × الوزن المحتسب", zh: "单价 × 计费重量" },
      math: `${measure(base, cost.unit)} × ${money(cost.effectiveRate)}/${unit} = ${money(cost.totalCostUsd)}`,
      ignored: null,
    };
  }
  if (!(cost.effectiveRate > 0)) {
    return {
      label: {
        ku: "کۆی پسووڵەی کارگۆ — تێچووی هەر یەکە کاتێک دەردەکەوێت کە کێش هەبێت",
        en: "Carrier's invoice — the cost per unit shows once there is a weight",
        ar: "فاتورة الناقل — تظهر تكلفة الوحدة عند توفر الوزن",
        zh: "承运商账单 — 有重量后显示单位成本",
      },
      math: money(cost.totalCostUsd),
      ignored: null,
    };
  }
  return {
    label: { ku: "کۆی پسووڵەی کارگۆ", en: "Carrier's invoice", ar: "فاتورة الناقل", zh: "承运商账单" },
    math: `${money(cost.totalCostUsd)} ÷ ${measure(base, cost.unit)} = ${money(cost.effectiveRate)}/${unit}`,
    ignored: cost.ignoredRate > 0 && Math.abs(cost.ignoredRate - cost.effectiveRate) >= 0.005
      ? `${money(cost.ignoredRate)}/${unit}`
      : null,
  };
}
