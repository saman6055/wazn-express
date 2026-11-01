import { describe, it, expect } from "vitest";
import { buildBoxReceiptHtml, paidBeforeOnBox } from "@/lib/deliveryBoxPrintUtils";
import { receiptDinar } from "@shared/receiptDinar";

/*
 * Owner, 2026-10-19, AZ295 BOX-20261001-001: the window before printing
 * asked $39.92 where $12.33 was owed. The box is $58.14; $27.59 of it was
 * paid on 07/10 (RCP-20261007-0005) and $18.22 of credit waits on the
 * account. The window took off the credit and never the earlier receipt.
 */
const VIEW = {
  parcels: [
    { settledUsd: 6.2, advanceUsd: 0, outstandingUsd: 0, notChargedYet: false },
    { settledUsd: 10, advanceUsd: 0, outstandingUsd: 18.7, notChargedYet: false },
    { settledUsd: 11.39, advanceUsd: 0, outstandingUsd: 0, notChargedYet: false },
    { settledUsd: 0, advanceUsd: 0, outstandingUsd: 11.85, notChargedYet: false },
  ],
  settlements: [{ status: "confirmed", settlementNumber: "RCP-20261007-0005" }],
};

describe("what an earlier receipt of the box paid comes off", () => {
  it("counts the receipts' own lines while the box still owes", () => {
    expect(paidBeforeOnBox(VIEW)).toEqual({ usd: 27.59, receipt: "RCP-20261007-0005" });
  });

  it("is nothing for a box paid in full (the paper is a copy) or never receipted", () => {
    expect(paidBeforeOnBox({ ...VIEW, parcels: VIEW.parcels.map((p) => ({ ...p, outstandingUsd: 0 })) }).usd).toBe(0);
    expect(paidBeforeOnBox({ ...VIEW, settlements: [] }).usd).toBe(0);
    expect(paidBeforeOnBox({ ...VIEW, settlements: [{ status: "reversed", settlementNumber: "X" }] }).usd).toBe(0);
  });

  it("never counts an order's advance as paid on a receipt", () => {
    const withAdvance = { ...VIEW, parcels: [{ settledUsd: 5, advanceUsd: 5, outstandingUsd: 3, notChargedYet: false }] };
    expect(paidBeforeOnBox(withAdvance).usd).toBe(0);
  });

  it("the paper: total, paid earlier, left to pay - and the dinars from what is left", () => {
    const t = (k: string) => k;
    const html = buildBoxReceiptHtml(
      { boxCode: "BOX-20261001-001", status: "open", deliveryMethod: "warehouse_pickup", totalValueUsd: "58.14", deliveryChargeUsd: "0", totalPackages: 4, createdAt: new Date() } as never,
      [],
      null,
      t as never,
      {
        settlement: { paidBeforeUsd: 27.59, settlementNumber: "RCP-20261007-0005" },
        dinar: { rate: 1580, step: 250, mode: "nearest", advanceAmount: 18.22, advanceCurrency: "USD" },
      },
    );
    expect(html).toContain("delivery.paidEarlier (RCP-20261007-0005)");
    expect(html).toContain("− $27.59");
    expect(html).toContain("delivery.leftToPay");
    expect(html).toContain("$30.55");
    const d = receiptDinar(30.55, { rate: 1580, step: 250, mode: "nearest", advanceAmount: 18.22, advanceCurrency: "USD" });
    expect(d?.dueUsd).toBe(12.33);
  });
});
