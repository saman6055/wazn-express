import { describe, expect, it } from "vitest";
import { formatBatchEta, getBatchEta } from "./batchEta";

describe("the estimated arrival reads like every other portal date", () => {
  it("writes an exact date as dd/mm/yyyy, not an English month name", () => {
    const eta = getBatchEta({ status: "in_transit", estimatedArrival: "2026-08-12T00:00:00Z" });
    expect(eta?.kind).toBe("exact");
    const text = formatBatchEta(eta!, "ku");
    expect(text).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(text).not.toMatch(/Aug/);
  });

  it("writes a range with the year said once, at the end", () => {
    const eta = getBatchEta({ status: "in_transit", shippingType: "air_regular", departureDate: "2026-08-01T00:00:00Z" });
    expect(eta?.kind).toBe("range");
    expect(formatBatchEta(eta!, "en")).toMatch(/^\d{2}\/\d{2} – \d{2}\/\d{2}\/\d{4}$/);
  });

  it("keeps the Chinese form for Chinese readers", () => {
    const eta = getBatchEta({ status: "in_transit", estimatedArrival: "2026-08-12T00:00:00Z" });
    expect(formatBatchEta(eta!, "zh")).toMatch(/年.*月.*日/);
  });

  it("says a year at both ends when the range crosses one", () => {
    // Sea: 30–45 days after 20 November lands one end in December and the
    // other in January.
    const eta = getBatchEta({ status: "in_transit", shippingType: "sea", departureDate: "2026-11-20T12:00:00Z" });
    const text = formatBatchEta(eta!, "en");
    expect(text.match(/\d{4}/g)?.length).toBe(2);
  });
});
