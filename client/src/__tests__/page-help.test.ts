/** Every finance page that was unclear says what it is, how, and what to do (owner, 2026-11-05). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { HELP } from "@/components/finance/pageHelpTexts";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("page help", () => {
  it("each text has all three lines in Kurdish", () => {
    for (const [k, t] of Object.entries(HELP)) for (const part of [t.what, t.how, t.use]) expect(part.ku.length, k).toBeGreaterThan(20);
  });
  it("is on the pages", () => {
    for (const f of ["client/src/pages/batches/GoodsOnRoad.tsx", "client/src/pages/finance/ExtraCosts.tsx", "client/src/pages/finance/YuanRateHistory.tsx", "client/src/pages/finance/DebtorsReport.tsx", "client/src/pages/finance/Payments.tsx", "client/src/pages/finance/Finance.tsx"]) {
      expect(read(f), f).toContain("<PageHelp id=");
    }
  });
});
