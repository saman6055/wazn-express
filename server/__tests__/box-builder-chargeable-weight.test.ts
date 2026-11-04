/**
 * A box line built from a parcel ("box them all", batch boxes) weighs it by
 * the one rule — configured divisor and volumetric discount — so the kilos
 * on the line agree with the price beside them (2026-11-05).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("box line built from a parcel", () => {
  it("uses chargeableWeight with the configured divisor, not its own /6000", () => {
    const src = read("server/db/deliveryBoxes.db.ts");
    const start = src.indexOf("export async function buildBoxItemValuesFromPackage(");
    const fn = src.slice(start, start + 4000);
    expect(fn).toContain("chargeableWeight(pkg, divisor).chargeableKg");
    expect(fn).toContain("getVolumetricDivisor()");
    expect(fn).not.toContain("/ 6000");
  });
});
