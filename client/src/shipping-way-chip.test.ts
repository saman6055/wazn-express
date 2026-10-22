import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { shippingWayOf } from "./components/ShippingWayChip";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/** Owner, 2026-10-22: show how each one comes - air regular, air irregular or sea. */
describe("the way each parcel and order comes, in the three tables", () => {
  it("the batch it is on decides; before a batch, its own choice", () => {
    expect(shippingWayOf("sea", "air_regular")).toBe("sea");
    expect(shippingWayOf(null, "air_irregular")).toBe("air_irregular");
    expect(shippingWayOf(undefined, undefined)).toBeNull();
    expect(shippingWayOf("nonsense", "air_regular")).toBe("air_regular");
  });

  it("one chip in the commission, full-package and All Packages tables", () => {
    const line = "<ShippingWayChip batchType={(order as any).batch?.shippingType} ownType={(order as any).shippingType} language={language} />";
    expect(read("client/src/pages/CommissionDashboard.tsx")).toContain(line);
    expect(read("client/src/pages/FullPackageDashboard.tsx")).toContain(line);
    expect(read("client/src/pages/Packages.tsx")).toContain("<ShippingWayChip batchType={getBatchShippingType(pkg.batchId)} ownType={pkg.shippingType} language={language} />");
  });
});
