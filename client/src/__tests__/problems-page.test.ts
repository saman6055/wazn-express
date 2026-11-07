import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", "..", p), "utf8");

/**
 * Owner, 2026-11-07, on «کێشەکانی ئێستا»: more useful, easy, good-looking -
 * and every figure true. Counts of real rows only; no estimate, no money.
 */
describe("the problems page", () => {
  const page = read("client/src/pages/admin/Problems.tsx");

  it("counts by urgency, filters by area, and puts urgent first", () => {
    expect(page).toContain('data-testid="problems-summary"');
    expect(page).toContain('data-testid="problems-areas"');
    expect(page.indexOf("{renderChecks(urgentFound)}")).toBeLessThan(page.indexOf('{shows("boxes") && parcels > 0 && ('));
    expect(page.indexOf('{shows("boxes") && parcels > 0 && (')).toBeLessThan(page.indexOf("{renderChecks(otherFound)}"));
  });

  it("shows how long each customer has waited, longest first, with a button to box them", () => {
    expect(page).toContain('data-testid="left-out-days"');
    expect(page).toContain("/customer-delivery-scanner?customer=${c.customerId}");
    const db = read("server/db/boxMissing.db.ts");
    // The wait is the parcel's own arrival scan, else its batch's last arrival.
    expect(db).toContain("const at = ownArrival.get(p.id) ?? lastArrival.get(Number(p.batchId)) ?? null;");
    expect(db).toContain("b.oldestDays - a.oldestDays || b.parcels.length - a.parcels.length");
  });

  it("wears the dashboard's moving layer and click sound", () => {
    expect(page).toContain('className="dash-live');
    expect(page).toContain("soundManager.playTap()");
  });
});
