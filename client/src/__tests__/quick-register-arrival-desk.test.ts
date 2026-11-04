import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * «گەیشتنی تۆمار بکە» is offered by where the person is, not by the chosen
 * warehouse (owner, 2026-11-04): in Erbil with Guangzhou chosen for the load,
 * a carton of another batch is an arrival.
 */
const src = readFileSync(resolve(__dirname, "../pages/packages/QuickRegister.tsx"), "utf8");

describe("the arrival button on a carton of another batch", () => {
  it("reads the person's own desk", () => {
    expect(src).toContain("const { data: ownDesk } = trpc.batches.carrierGroup.myDesk.useQuery();");
    expect(src).toContain("arrivalDue(already, ownDesk?.inChina)");
    expect(src).not.toContain("arrivalDue(already, desk?.inChina)");
  });

  it("stays a duplicate when a China batch still being packed is chosen", () => {
    expect(src).toContain('?.find((b) => String(b.id) === batchId)?.status === "preparing")');
  });
});
