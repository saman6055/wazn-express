/**
 * A box payment says where the money went - cash, FIB or Qi Card (the CARD
 * method) - and the money received is shown by place (owner, 2026-11-05).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");

describe("where the box's money went", () => {
  it("both payment windows send the chosen method", () => {
    for (const f of ["client/src/components/delivery/QuickSettleDialog.tsx", "client/src/components/delivery/BoxSettlementPanel.tsx"]) {
      const s = read(f);
      expect(s, f).toContain("<MoneyChannelPicker value={channel} onChange={setChannel} />");
      expect(s, f).toContain("paymentMethod: channel,");
    }
  });
  it("the column accepts FIB, and the page reads money by method", () => {
    expect(read("server/_core/migrations.ts")).toContain('"paymentRecords.paymentMethod.wallets"');
    expect(read("server/db/workingCapital.db.ts")).toContain("export async function getMoneyReceivedByMethod(");
    expect(read("client/src/pages/finance/WorkingCapital.tsx")).toContain('data-testid="money-received-by-method"');
  });
});
