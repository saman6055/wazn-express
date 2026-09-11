import { DEFAULT_VOLUMETRIC_DIVISOR, volumeCbm, volumetricWeightKg } from "@shared/chargeableWeight";
import { toPlainDigits } from "./cleanPaste";

/**
 * Sums typed straight into a field: "4.5 + 3.2" becomes 7.7 on Enter.
 *
 * Weighing three cartons meant a calculator beside the keyboard. Only numbers,
 * + − × ÷ and brackets are read — nothing is ever run as code — and a text
 * that is not a sum gives null, so the field keeps exactly what was typed.
 */
export function evaluateSum(text: string): number | null {
  const src = toPlainDigits(text)
    .replace(/\u066B/g, ".")
    .replace(/[xX*\u00D7]/g, "*")
    .replace(/[/\u00F7]/g, "/")
    .replace(/[\u2212\u2013]/g, "-")
    .replace(/\s+/g, "");
  if (!/^[0-9.+\-*/()]+$/.test(src)) return null;
  if (!/[+\-*/]/.test(src.replace(/^[+-]/, ""))) return null; // a plain number is not a sum

  let at = 0;
  const fail = (): never => {
    throw new Error("not a sum");
  };
  const number = (): number => {
    const m = /^(\d+(\.\d+)?|\.\d+)/.exec(src.slice(at));
    if (!m) return fail();
    at += m[0].length;
    return parseFloat(m[0]);
  };
  // expression = term (± term)* ; term = factor (×÷ factor)* ; factor = ±factor | (expression) | number
  const factor = (): number => {
    const c = src[at];
    if (c === "-") {
      at++;
      return -factor();
    }
    if (c === "+") {
      at++;
      return factor();
    }
    if (c === "(") {
      at++;
      const inner = expression();
      if (src[at] !== ")") fail();
      at++;
      return inner;
    }
    return number();
  };
  const term = (): number => {
    let value = factor();
    while (src[at] === "*" || src[at] === "/") {
      const op = src[at++];
      const right = factor();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  };
  const expression = (): number => {
    let value = term();
    while (src[at] === "+" || src[at] === "-") {
      const op = src[at++];
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };

  try {
    const value = expression();
    if (at !== src.length || !Number.isFinite(value)) return null;
    return Math.round(value * 1e6) / 1e6; // 0.1 + 0.2 is 0.3 here, not 0.30000000000000004
  } catch {
    return null;
  }
}

export interface Sides {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/** "40x50x60", "40×50×60", "40*50*60" or "40 50 60" (centimetres) → the three sides, or null. */
export function parseDimensions(text: string): Sides | null {
  const parts = toPlainDigits(text)
    .replace(/\u066B/g, ".")
    .trim()
    .split(/\s*[xX*\u00D7]\s*|\s+/)
    .filter(Boolean);
  if (parts.length !== 3) return null;
  const [lengthCm, widthCm, heightCm] = parts.map(Number);
  if (![lengthCm, widthCm, heightCm].every((v) => Number.isFinite(v) && v > 0)) return null;
  return { lengthCm, widthCm, heightCm };
}

/**
 * What typed dimensions come to: cubic metres and volumetric weight, from the
 * one shared formula (shared/chargeableWeight.ts) with the install's divisor.
 * This only shows the figures; the price is still worked out where it always was.
 */
export function measureDimensions(text: string, divisor: number = DEFAULT_VOLUMETRIC_DIVISOR) {
  const sides = parseDimensions(text);
  if (!sides) return null;
  return { ...sides, cbm: volumeCbm(sides), volumetricKg: volumetricWeightKg(sides, divisor) };
}
