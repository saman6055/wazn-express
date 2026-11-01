import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The Portal Center's prices tab, phase 5 of the owner's brief (2026-09-18):
 * a carton can be tried against the divisor and the prices as they are
 * typed, before they are saved. The arithmetic is shared/portalQuote.ts,
 * unit-tested against the portal's own calculator; this pins the wiring, and
 * that the sandbox saves nothing.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const page = read("client/src/pages/PortalCenter.tsx");
const sandbox = read("client/src/components/portal-center/PriceSandbox.tsx");

describe("try a carton before saving", () => {
  it("next to the divisor, with the divisor and the prices as typed", () => {
    expect(page).toContain("<CalcSettingsCard p={p} prices={form} />");
    expect(page).toContain("<PriceSandbox divisor={parseFloat(form.volumetricDivisor) || 0} prices={prices} />");
  });

  it("worked as the portal's calculator and the invoice work it", () => {
    expect(sandbox).toContain("const q = quoteShipping(");
    expect(sandbox).toContain("const usedDivisor = divisor > 0 ? divisor : DEFAULT_VOLUMETRIC_DIVISOR;");
  });

  it("and it saves nothing", () => {
    expect(sandbox).not.toMatch(/trpc|useMutation|localStorage/);
  });

  it("opens with an example carton, so it shows a result at once", () => {
    expect(sandbox).toContain('useState({ l: "60", w: "40", h: "40", kg: "12", cbm: "" })');
  });
});
