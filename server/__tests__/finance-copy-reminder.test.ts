/** Today's copy of the accounts: one press, and a reminder until it is taken (owner, 2026-11-06). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildRiskItems } from "@shared/riskBell";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
describe("finance copy", () => {
  it("rings the main admin's bell until today's copy is taken", () => {
    const base = { staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0, emptyBoxes: 0, whatsappUnsent: 0, lossForecastUsd: 0, ordersSlowThisWeek: null, partnerOverdrawUsd: 0 } as never;
    expect(buildRiskItems({ ...(base as object), financeCopyMissing: 1 } as never).map((i) => i.id)).toContain("finance-copy");
    expect(buildRiskItems({ ...(base as object), financeCopyMissing: 0 } as never).map((i) => i.id)).not.toContain("finance-copy");
  });
  it("is one press on working capital, and in the centre's waiting list", () => {
    expect(read("client/src/components/finance/NightlyMailCard.tsx")).toContain('data-testid="finance-copy-download"');
    expect(read("client/src/pages/finance/FinanceCenter.tsx")).toContain("financeCopyMissing");
  });
});
