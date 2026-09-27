import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { onTheWayWords, travelModeOf } from "./travelMode";
import { batchStatusWords, STATUS_LABEL } from "./shipmentFilters";

/**
 * The owner, 2026-09-27: an air shipment said "on a plane or a ship" and
 * showed a truck. The mode is known; the words and the icon say it.
 */
describe("on the way, by air or by sea", () => {
  it("reads the mode from every shipping type the office uses", () => {
    expect(travelModeOf("air_regular")).toBe("air");
    expect(travelModeOf("air_irregular")).toBe("air");
    expect(travelModeOf("sea")).toBe("sea");
    expect(travelModeOf("")).toBeNull();
    expect(travelModeOf(null)).toBeNull();
  });

  it("says the owner's words", () => {
    expect(onTheWayWords("air_regular").ku).toBe("لە ڕێگای ئاسمانی");
    expect(onTheWayWords("sea").ku).toBe("لە ڕێگای دەریایی");
    expect(onTheWayWords(undefined).ku).toBe("لە ڕێگادایە");
  });

  it("a shipment in transit says how it travels; other statuses keep their names", () => {
    expect(batchStatusWords("in_transit", "air_regular")?.ku).toBe("لە ڕێگای ئاسمانی");
    expect(batchStatusWords("in_transit", "sea")?.ku).toBe("لە ڕێگای دەریایی");
    expect(batchStatusWords("in_transit", null)).toBe(STATUS_LABEL.in_transit);
    expect(batchStatusWords("customs", "sea")).toBe(STATUS_LABEL.customs);
  });

  it("no portal shipment chip draws a truck for in transit", () => {
    for (const file of ["../pages/portal/PortalShipments.tsx", "../pages/portal/PortalHome.tsx"]) {
      const src = fs.readFileSync(path.join(__dirname, file), "utf8").replace(/\r\n/g, "\n");
      const at = src.indexOf('case "in_transit":', src.indexOf("const getStatusIcon"));
      expect(at, file).toBeGreaterThan(0);
      const branch = src.slice(at, src.indexOf(";", at));
      expect(branch, file).not.toContain("Truck");
      expect(branch, file).toContain("travelModeOf(");
    }
  });
});
