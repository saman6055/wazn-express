import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Today's Quick Register card: every tile and every customer opens the
 * parcels behind it (owner, 2026-11-05: «لینکی لە هەموو پاکەتەکانیش هەبێ»).
 */
const card = readFileSync(resolve(__dirname, "../components/dashboard/RegistrationsSummaryCard.tsx"), "utf8");

describe("Quick Register card links", () => {
  it("tiles open today's parcels", () => {
    expect(card).toContain("packagesHref({ day })");
    expect(card).toContain('packagesHref({ day, shippingType: "sea" })');
  });

  it("each customer opens their parcels of today and their page", () => {
    expect(card).toContain("packagesHref({ search: customerCodeOnly(c.customerCode), day })");
    expect(card).toContain("href={`/customers/${c.customerId}`}");
  });
});
