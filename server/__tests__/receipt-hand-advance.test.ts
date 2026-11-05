/**
 * A hand advance typed in dinars is kept with the receipt, given back to the
 * receipt window in dinars, and given back to the receipt window in dinars (owner, 2026-11-05).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { receiptAdvanceIqd } from "../db/boxHandover.db";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("the hand advance in dinars", () => {
  it("an older paper gives its dinar advance back from its own figures (Vian: 76,000)", () => {
    expect(receiptAdvanceIqd({ advanceIqd: null, advanceUsd: 0, dueUsd: 474.35, rate: 1680, dueIqd: 721000 })).toBe(76000);
    expect(receiptAdvanceIqd({ advanceIqd: "50000", advanceUsd: 0, dueUsd: 100, rate: 1500, dueIqd: 100000 })).toBe(50000);
    expect(receiptAdvanceIqd({ advanceIqd: null, advanceUsd: 10, dueUsd: 100, rate: 1500, dueIqd: 135000 })).toBe(0);
    expect(receiptAdvanceIqd({ advanceIqd: null, advanceUsd: 0, dueUsd: 100, rate: 1500, dueIqd: 150000 })).toBe(0);
  });

  it("both paper writers keep it, the window refills it in dinars, both tills show it", () => {
    for (const f of ["client/src/components/delivery/BoxDetailPanel.tsx", "client/src/components/delivery/BoxTable.tsx"]) {
      expect(read(f)).toContain('advanceIqd: dinar?.advanceCurrency === "IQD" ? Number(dinar.advanceAmount || 0) : null,');
    }
    const win = read("client/src/components/delivery/ReceiptDinarDialog.tsx");
    expect(win).toContain("const beforeIqd = lastSent.data?.advanceIqd ?? 0;");
    expect(win).toContain('setCurrency("IQD");');
    // The payment windows stay as they were (owner, 2026-11-05: «پەنجەری جاران بکەوە»).
    expect(read("client/src/components/delivery/BoxSettlementPanel.tsx")).not.toContain("HandAdvanceNote");
    expect(read("client/src/components/delivery/QuickSettleDialog.tsx")).not.toContain("HandAdvanceNote");
    expect(read("server/_core/migrations.ts")).toContain('"boxReceiptEvents.advanceIqd"');
  });
});
