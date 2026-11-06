/** Point 41.1 and 41.2 (owner, 2026-11-06). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("smart controls", () => {
  it("a new box warns about the customer's earlier boxes with no receipt", () => {
    expect(read("client/src/components/delivery/CreateBoxDialog.tsx")).toContain("<UnpaidBoxesWarning customerId={selectedCustomerId} />");
    expect(read("server/routers/scanning.router.ts")).toContain("unreceiptedOf: staffProcedure");
  });
  it("the finance centre shows the boxes asleep on the shelf", () => {
    const fc = read("client/src/pages/finance/FinanceCenter.tsx");
    expect(fc).toContain('testId="fc-shelf"');
    expect(fc).toContain("trpc.deliveryBox.warehouseShelf.useQuery()");
  });
  it("the finance centre shows what was let go, by whom and why", () => {
    expect(read("client/src/pages/finance/FinanceCenter.tsx")).toContain('testId="fc-giveaways"');
    const pulse = read("server/db/financePulse.db.ts");
    expect(pulse).toContain("async function writeOffsBetween(");
    expect(pulse).toContain("LIKE '[قەرەبوو — پارە نییە]%'");
  });
});
