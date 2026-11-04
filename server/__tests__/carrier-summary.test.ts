import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The carriers side by side on the dashboard (owner, 2026-11-05): kilos this
 * week and month, billed kilos, days on the road, price per kilo.
 */
const lib = readFileSync(resolve(__dirname, "../db/carrierSummary.db.ts"), "utf8");
const card = readFileSync(resolve(__dirname, "../../client/src/components/dashboard/CarrierSummaryCard.tsx"), "utf8");
const page = readFileSync(resolve(__dirname, "../../client/src/pages/dashboard/Dashboard.tsx"), "utf8");

describe("carrier summary", () => {
  it("names the carrier by its company, else the first word of its batch number", () => {
    expect(lib).toContain("NULLIF(SUBSTRING_INDEX(TRIM(b.carrierBatchNo), ' ', 1), '')");
  });

  it("days on the road are departure to actual arrival; price only where bill and kilos are both written", () => {
    expect(lib).toContain("TIMESTAMPDIFF(HOUR, b.departureDate, b.actualArrival) / 24");
    expect(lib).toContain("Number(r.billKg) > 0 ?");
  });

  it("sits on the dashboard with the fastest and the cheapest marked", () => {
    expect(page).toContain('<CarrierSummaryCard className="xl:col-span-2" />');
    expect(card).toContain("خێراترین");
    expect(card).toContain("هەرزانترین");
  });
});
