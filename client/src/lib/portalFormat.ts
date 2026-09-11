/**
 * Numbers as the customer should read them — one shape each, in one place.
 *
 * The portal printed the same kinds of figure a dozen ways: `$1234.5` on the
 * home card and `$1,234.50` on the money page for the same balance; a weight
 * as `12.500 kg` on the batch page (the raw decimal column) and `12.50 kg`
 * on the depot list; dimensions as `30.00×20.00×10.00 cm`. None of it was
 * wrong, and all of it looked like three different companies.
 *
 * These are formatters only. They never compute anything: what comes in is
 * what the server already decided, and what goes out is the same number
 * written for a phone screen. A value that is not a number prints a dash,
 * never "NaN", "null" or "undefined".
 */

type Numeric = number | string | null | undefined;

const toNumber = (value: Numeric): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/** The dash the portal shows for a figure nobody recorded. */
export const NO_VALUE = "—";

/**
 * "-$0.00" and "-0" are not debts. A value that rounds to zero is written as
 * zero: a customer who sees a minus sign on nothing asks what they owe.
 * Intl keeps the sign of a tiny negative (-0.001 → "-$0.00"); this drops it
 * only when every digit shown is a zero.
 */
export function unsignedZero(text: string): string {
  return /^-[^1-9]*$/.test(text) ? text.slice(1) : text;
}

/**
 * US dollars: `$1,234.50`. Always two decimals, always thousands separators,
 * so a column of amounts lines up and $1,000 cannot be misread as $100.
 * Latin digits in every language — the money page already settled that.
 */
export function fmtUsd(value: Numeric): string {
  const n = toNumber(value);
  if (n === null) return NO_VALUE;
  return unsignedZero(
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n),
  );
}

/**
 * A plain number with separators and at most `maxDecimals` places, trailing
 * zeros dropped: 12 → "12", 12.5 → "12.5", 12.345 → "12.35".
 */
export function fmtNumber(value: Numeric, maxDecimals = 2): string {
  const n = toNumber(value);
  if (n === null) return NO_VALUE;
  return unsignedZero(
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals,
    }).format(n),
  );
}

/** Weight: `12.5 kg`. Two decimals at most; the scale is not more precise. */
export function fmtKg(value: Numeric): string {
  const n = toNumber(value);
  if (n === null) return NO_VALUE;
  return `${fmtNumber(n, 2)} kg`;
}

/** Volume: `0.125 m³`. Three decimals, because sea freight is billed on them. */
export function fmtCbm(value: Numeric): string {
  const n = toNumber(value);
  if (n === null) return NO_VALUE;
  return `${fmtNumber(n, 3)} m³`;
}

/**
 * A chargeable amount in whichever unit the batch is billed by. Sea batches
 * charge by volume, air by weight; the unit comes from the server row.
 */
export function fmtChargeable(value: Numeric, unit: string | null | undefined): string {
  return unit === "cbm" ? fmtCbm(value) : fmtKg(value);
}

/** Dimensions: `30×20×10 cm`. Whole centimetres unless a side is fractional. */
export function fmtDims(length: Numeric, width: Numeric, height: Numeric): string {
  const sides = [length, width, height].map(toNumber);
  if (sides.some((s) => s === null)) return NO_VALUE;
  return `${sides.map((s) => fmtNumber(s, 1)).join("×")} cm`;
}

/** A count for a sentence: never blank, never NaN — a missing count is 0. */
export function fmtCount(value: Numeric): number {
  return toNumber(value) ?? 0;
}
