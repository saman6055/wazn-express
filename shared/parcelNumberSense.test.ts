import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { oddParcelNumbers } from "./parcelNumberSense";

/*
 * Owner, 2026-10-04: a number that is not logical is asked about before it is
 * saved — for parcels too. UNC-000001 went in at 224 kg, UNC-000002 at 454.
 */
describe("a parcel's numbers", () => {
  it("the real slips are caught", () => {
    expect(oddParcelNumbers({ weightKg: "224" })).toHaveLength(1);
    expect(oddParcelNumbers({ weightKg: "454" })[0]).toContain("454");
    expect(oddParcelNumbers({ weightKg: "2", lengthCm: "500", widthCm: "40", heightCm: "30" }).join()).toContain("ملیمەتر");
    expect(oddParcelNumbers({ weightKg: "1", lengthCm: "120", widthCm: "100", heightCm: "60" }).join()).toContain("کێشی قەبارەیی");
  });

  it("ordinary cartons ask nothing", () => {
    expect(oddParcelNumbers({ weightKg: "3.2", lengthCm: "40", widthCm: "30", heightCm: "25" })).toEqual([]);
    expect(oddParcelNumbers({ weightKg: "28", lengthCm: "60", widthCm: "50", heightCm: "45" })).toEqual([]);
    expect(oddParcelNumbers({ volumeCbm: "0.326" })).toEqual([]);
    expect(oddParcelNumbers({})).toEqual([]);
  });

  it("both entry screens ask before saving", () => {
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", "client/src/pages", p), "utf8");
    for (const page of ["QuickRegister.tsx", "Packages.tsx"]) {
      const src = read(page);
      expect(src, page).toContain("oddParcelNumbers(");
      expect(src.indexOf("oddParcelQuestion(odd)"), page).toBeGreaterThan(-1);
    }
  });
});
