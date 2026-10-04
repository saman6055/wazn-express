/**
 * Numbers on a batch that do not make sense.
 *
 * SEA-125 was saved with 215 CBM charged while its parcels held 1.63. Nothing
 * asked, and for two months every profit figure carried a $46,225 cost that
 * was really $353 (owner fixed it 2026-10-04). The owner's rule, the same day:
 * when a number like that is typed, say so and ask once more — "confirm it
 * again, that number is not logical."
 *
 * A question, never a refusal: the number may be true. Anyone may answer it,
 * because the person typing is the one holding the carrier's paper. Only
 * questions about numbers that changed in this save are asked, so an old
 * figure does not nag on every edit.
 *
 * The usual rates come from the company's own past batches (the median of each
 * field), so "usual" follows the business instead of a constant written here.
 */

/** Below these many past batches the medians are too thin; fixed figures stand in. */
export const MIN_HISTORY = 5;

/** A figure this many times above (or this fraction below) the usual is asked about. */
export const FAR_ABOVE = 2.5;
export const FAR_BELOW = 0.4;

/** Stand-ins until there is history: air ≈ $9/kg cost, $11 sell; sea ≈ $260/CBM cost, $300 sell. */
export const FALLBACK_USUAL: UsualRates = {
  costPerKg: 9,
  pricePerKg: 11,
  costPerCbm: 260,
  pricePerCbm: 300,
};

export interface UsualRates {
  costPerKg: number | null;
  pricePerKg: number | null;
  costPerCbm: number | null;
  pricePerCbm: number | null;
}

export interface BatchNumbers {
  shippingType?: string | null;
  chargedWeightKg?: string | number | null;
  chargedCbm?: string | number | null;
  actualWeightKg?: string | number | null;
  actualCbm?: string | number | null;
  costPerKg?: string | number | null;
  costPerCbm?: string | number | null;
  pricePerKg?: string | number | null;
  pricePerCbm?: string | number | null;
  shippingCost?: string | number | null;
}

/** What the batch's own parcels add up to. Null before any parcel is in it. */
export interface ParcelTotals {
  count: number;
  weightKg: number;
  cbm: number;
}

export interface OddNumber {
  /** Stable key: the same oddness on the stored batch is not asked again. */
  key: string;
  /** One plain Sorani line: the number, and what it was compared with. */
  line: string;
}

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => {
  const s = n >= 10 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toFixed(4);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
};

/** The median of the positive values, or null when there are too few. */
export function medianOf(values: ReadonlyArray<string | number | null | undefined>): number | null {
  const xs = values.map(num).filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (xs.length < MIN_HISTORY) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** The usual rates from past batches, each falling back to the stand-in. */
export function usualRates(past: ReadonlyArray<BatchNumbers>): UsualRates {
  const sea = past.filter((b) => b.shippingType === "sea");
  const air = past.filter((b) => b.shippingType !== "sea");
  return {
    costPerKg: medianOf(air.map((b) => b.costPerKg)) ?? FALLBACK_USUAL.costPerKg,
    pricePerKg: medianOf(air.map((b) => b.pricePerKg)) ?? FALLBACK_USUAL.pricePerKg,
    costPerCbm: medianOf(sea.map((b) => b.costPerCbm)) ?? FALLBACK_USUAL.costPerCbm,
    pricePerCbm: medianOf(sea.map((b) => b.pricePerCbm)) ?? FALLBACK_USUAL.pricePerCbm,
  };
}

/** Every number on this batch that does not make sense. Empty = nothing to ask. */
export function oddBatchNumbers(
  batch: BatchNumbers,
  usual: UsualRates,
  parcels: ParcelTotals | null,
): OddNumber[] {
  const sea = batch.shippingType === "sea";
  const unit = sea ? "CBM" : "کیلۆ";
  const out: OddNumber[] = [];

  // 1. What we pay for, against what is actually in the batch.
  const have = parcels && parcels.count > 0 ? (sea ? parcels.cbm : parcels.weightKg) : 0;
  const slack = sea ? 0.5 : 5;
  const measures: Array<[string, string, number | null]> = sea
    ? [["chargedCbm", "قەبارەی حسابکراو", num(batch.chargedCbm)], ["actualCbm", "قەبارەی ڕاستەقینە", num(batch.actualCbm)]]
    : [["chargedWeightKg", "کێشی حسابکراو", num(batch.chargedWeightKg)], ["actualWeightKg", "کێشی ڕاستەقینە", num(batch.actualWeightKg)]];
  if (have > 0) {
    for (const [field, label, value] of measures) {
      if (value === null) continue;
      if (value > have * FAR_ABOVE && value - have > slack) {
        out.push({
          key: `${field}:above`,
          line: `${label} ${qty(value)} ${unit}ە، بەڵام پاکەتەکانی ئەم باچە هەموویان ${qty(have)} ${unit}ن (${(value / have).toFixed(0)} ئەوەندە).`,
        });
      } else if (value < have * 0.6) {
        out.push({
          key: `${field}:below`,
          line: `${label} ${qty(value)} ${unit}ە، بەڵام پاکەتەکانی ئەم باچە ${qty(have)} ${unit}ن — کەمترە لەوەی تێیدایە.`,
        });
      }
    }
  }

  // 2. A rate far from what this company usually pays or charges.
  const rates: Array<[string, string, number | null, number | null]> = sea
    ? [
        ["costPerCbm", "تێچووی هەر CBM", num(batch.costPerCbm), usual.costPerCbm],
        ["pricePerCbm", "نرخی فرۆشتنی هەر CBM", num(batch.pricePerCbm), usual.pricePerCbm],
      ]
    : [
        ["costPerKg", "تێچووی هەر کیلۆ", num(batch.costPerKg), usual.costPerKg],
        ["pricePerKg", "نرخی فرۆشتنی هەر کیلۆ", num(batch.pricePerKg), usual.pricePerKg],
      ];
  for (const [field, label, value, typical] of rates) {
    if (value === null || !typical) continue;
    if (value > typical * FAR_ABOVE) {
      out.push({
        key: `${field}:high`,
        line: `${label} ${usd(value)}ە — ئاسایی نزیکەی ${usd(typical)}ە (${(value / typical).toFixed(0)} ئەوەندە).` +
          (field.startsWith("cost") ? " ئەگەر ئەمە کۆی پسوولەکەیە، لە خانەی «کۆی کرێی گەیاندن» بینووسە." : ""),
      });
    } else if (value < typical * FAR_BELOW) {
      out.push({
        key: `${field}:low`,
        line: `${label} ${usd(value)}ە — ئاسایی نزیکەی ${usd(typical)}ە.` +
          (sea ? " لەوانەیە نرخی کیلۆ بێت کە لە خانەی CBM نووسراوە." : ""),
      });
    }
  }

  // 3. The carrier's rate × what we pay for, against the total typed for it.
  const rate = num(sea ? batch.costPerCbm : batch.costPerKg);
  const base = num(sea ? batch.chargedCbm : batch.chargedWeightKg);
  const total = num(batch.shippingCost);
  if (rate !== null && base !== null && total !== null) {
    const product = rate * base;
    if (Math.abs(product - total) > Math.max(20, total * 0.25)) {
      out.push({
        key: "rateTimesBase:total",
        line: `تێچووی هەر ${unit} × ${unit}ی حسابکراو = ${usd(product)}، بەڵام کۆی کرێی گەیاندن ${usd(total)} نووسراوە.`,
      });
    }
  }

  return out;
}

/** Only what this save made odd: anything already odd on the stored batch is not asked again. */
export function newlyOdd(next: OddNumber[], previous: OddNumber[] | null): OddNumber[] {
  if (!previous) return next;
  const before = new Set(previous.map((o) => o.key));
  return next.filter((o) => !before.has(o.key));
}

/** Marks the server's question so the form knows to ask, not to fail. */
export const ODD_NUMBER_MARK = "[[odd-number]]";

/** The question, in the owner's words. */
export function oddNumberQuestion(odd: readonly OddNumber[]): string {
  return (
    `${ODD_NUMBER_MARK}ئەم ژمارانە لۆجیکی نین:\n\n` +
    odd.map((o) => `• ${o.line}`).join("\n") +
    "\n\nتکایە دووبارە دڵنیا بەرەوە. ئەگەر ژمارەکان ڕاستن، «بەڵێ، ڕاستە» دابگرە."
  );
}

export function isOddNumberQuestion(message: string | null | undefined): boolean {
  return !!message && message.startsWith(ODD_NUMBER_MARK);
}

/** The question without its mark, for showing. */
export function oddNumberText(message: string): string {
  return message.startsWith(ODD_NUMBER_MARK) ? message.slice(ODD_NUMBER_MARK.length) : message;
}
