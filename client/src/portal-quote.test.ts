import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { chargeableWeight } from "@shared/chargeableWeight";

/**
 * The price the portal quotes must be the price the invoice charges.
 *
 * The calculator ran its own arithmetic and reached a different number, in two
 * ways at once:
 *
 *   • it applied `airMinKg`, `seaMinCbm` and `seaSurchargePct` — three admin
 *     settings that appear nowhere in any charging path on the server. A
 *     0.4 kg parcel was quoted as 1 kg and billed as 0.4; a 0.1 CBM sea parcel
 *     was quoted +25% and billed flat.
 *   • it divided by `portal_calc_settings.volumetricDivisor` while billing
 *     divided by the `cbm_divisor` setting — two knobs for one number, with
 *     nothing keeping them equal.
 *
 * A customer who is quoted $12.00 and invoiced $4.80 does not conclude that
 * the calculator is approximate.
 */

const SRC = path.resolve(__dirname);
const CALC = fs.readFileSync(path.join(SRC, "components/portal/PriceListSection.tsx"), "utf8");

describe("the quote is the invoice", () => {
  it("the calculator uses the same chargeable-weight function as billing", () => {
    expect(CALC).toContain('from "@shared/chargeableWeight"');
    expect(CALC).toMatch(/chargeableWeight\(/);
  });

  it("the calculator applies no rule the server does not charge", () => {
    // Present as type fields and in the explanatory comment; what matters is
    // that none of them takes part in the arithmetic.
    const math = CALC.slice(CALC.indexOf("const actualKg"), CALC.indexOf("const total ="));
    for (const setting of ["airMinKg", "seaMinCbm", "seaSurchargePct"]) {
      expect(math, `${setting} is quoted but never billed`).not.toContain(setting);
    }
  });

  it("sea is quoted on volume outright, as portal.db charges it", () => {
    const math = CALC.slice(CALC.indexOf("const cbm ="), CALC.indexOf("const total ="));
    expect(math).toMatch(/cbm \* price/);
    expect(math).not.toMatch(/1 \+ /);
  });

  it("there is one reader of the volumetric divisor", () => {
    // batches.db kept a private copy that read a different setting from the
    // one the calculator used.
    const settings = fs.readFileSync(path.resolve(SRC, "../../server/db/settings.db.ts"), "utf8");
    const batches = fs.readFileSync(path.resolve(SRC, "../../server/db/batches.db.ts"), "utf8");

    expect(settings).toContain("export async function getVolumetricDivisor");
    expect(batches, "batches.db must import it, not redefine it")
      .not.toMatch(/async function getVolumetricDivisor/);
    expect(settings, "the quote must follow the billing divisor")
      .toMatch(/volumetricDivisor: await getVolumetricDivisor\(\)/);
  });
});

describe("the arithmetic itself", () => {
  it("charges the greater of scale weight and volume", () => {
    // 40×30×20 cm ÷ 6000 = 4 kg volumetric against 2 kg on the scale.
    const light = chargeableWeight({ weightKg: 2, lengthCm: 40, widthCm: 30, heightCm: 20 }, 6000);
    expect(light.chargeableKg).toBe(4);
    expect(light.billedOnVolume).toBe(true);

    const heavy = chargeableWeight({ weightKg: 9, lengthCm: 40, widthCm: 30, heightCm: 20 }, 6000);
    expect(heavy.chargeableKg).toBe(9);
    expect(heavy.billedOnVolume).toBe(false);
  });

  it("does not round a small parcel up to a minimum", () => {
    // This is the case the old calculator overstated: quoted 1 kg, billed 0.4.
    const small = chargeableWeight({ weightKg: 0.4 }, 6000);
    expect(small.chargeableKg).toBe(0.4);
  });

  it("gives nothing when there is nothing to measure", () => {
    expect(chargeableWeight({ weightKg: 0 }, 6000).chargeableKg).toBe(0);
    expect(chargeableWeight({ weightKg: null }, 6000).chargeableKg).toBe(0);
  });
});
