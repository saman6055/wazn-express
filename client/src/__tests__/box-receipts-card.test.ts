/** The invoices page holds the box receipts the work runs on (owner, 2026-11-05). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("box receipts on the invoices page", () => {
  it("is shown there and read from its own route", () => {
    expect(read("client/src/pages/finance/Invoices.tsx")).toContain("<BoxReceiptsCard />");
    expect(read("client/src/components/finance/BoxReceiptsCard.tsx")).toContain("trpc.deliveryBox.listReceipts.useQuery(");
    expect(read("server/routers/scanning.router.ts")).toContain("listReceipts: staffProcedure");
  });
});
