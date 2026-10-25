/**
 * Owner, 2026-10-25: a box paid in part is orange everywhere, says what was
 * paid and what is left, may go out, is reminded after five days, and the
 * finance profile takes money for a box at the box.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { REMIND_AFTER_DAYS } from "@shared/boxReminder";
import { receiptWhatsAppMessage } from "@shared/receiptWhatsApp";

const read = (p: string) => readFileSync(p, "utf8");

describe("a box paid in part", () => {
  it("is orange in the list, in the box and in the customer's boxes", () => {
    expect(read("client/src/components/delivery/BoxTable.tsx")).toContain("(box as any).paidInPart === true && (");
    expect(read("client/src/components/delivery/BoxDetailPanel.tsx")).toContain('data-testid="box-partial"');
    expect(read("client/src/components/delivery/CustomerBoxesPanel.tsx")).toContain("b.paidInPart ? \"bg-orange-100");
  });

  it("comes first in the list", () => {
    expect(read("server/db/deliveryBoxes.db.ts")).toContain("desc(sql`EXISTS (SELECT 1 FROM ${boxSettlements} s WHERE s.boxId = ${deliveryBoxes.id} AND s.status = 'confirmed')`)");
  });

  it("the paper and the message thank for what came and ask gently for the rest", () => {
    expect(read("client/src/lib/deliveryBoxPrintUtils.ts")).toContain('t("delivery.politeRest")');
    const ku = receiptWhatsAppMessage("ku", { boxCode: "BOX-1", parcelCount: 3, totalUsd: 83.59, totalIqd: null, customerName: "Sinan Ibrahim", paidUsd: 100 });
    expect(ku).toContain("دراوە: 100.00 دۆلار");
    expect(ku).toContain("ماوە: 83.59 دۆلار");
    expect(ku).toContain("کاتێکی گونجاودا");
    const plain = receiptWhatsAppMessage("ku", { boxCode: "BOX-1", parcelCount: 3, totalUsd: 183.59, totalIqd: null, customerName: "Sinan" });
    expect(plain).not.toContain("دراوە:");
  });

  it("is reminded after five days, with a button in the box", () => {
    expect(REMIND_AFTER_DAYS).toBe(5);
    expect(read("client/src/components/delivery/BoxDetailPanel.tsx")).toContain('testId="box-remind-rest"');
  });
});

describe("the finance profile and the box are one body", () => {
  it("a payment asks for which box first, and opens that box", () => {
    const page = read("client/src/pages/CustomerFinance.tsx");
    expect(page).toContain("function PayForWhichBox(");
    expect(page).toContain("href={`/customer-delivery-scanner?box=${b.id}`}");
    expect(page).toContain('data-testid="pay-without-box"');
    expect(page).toContain("<CustomerBoxesPanel customerId={customerId} />");
  });
});

describe("the rest stays on the box (real-MySQL proved 2026-10-25)", () => {
  it("a shortfall kept as debt comes off the last lines", async () => {
    const { leaveShortOnLines } = await import("@shared/boxSettlement");
    expect(leaveShortOnLines([{ paidUsd: 100 }, { paidUsd: 83.59 }], 83.59).map((l) => l.paidUsd)).toEqual([100, 0]);
    expect(leaveShortOnLines([{ paidUsd: 100 }, { paidUsd: 83.59 }], 120).map((l) => l.paidUsd)).toEqual([63.59, 0]);
    expect(read("server/db/boxSettlement.db.ts")).toContain("leaveShortOnLines(totals.lines, difference.amountUsd)");
  });
  it("only receipts from the rule's day on are 'paid in part' - old boxes are left alone", async () => {
    const { isPaidInPart } = await import("@shared/boxSettlement");
    expect(isPaidInPart({ differenceKind: "debt", createdAt: "2026-10-26T10:00:00Z" }, 83.59)).toBe(true);
    expect(isPaidInPart({ differenceKind: "debt", createdAt: "2026-10-01T10:00:00Z" }, 83.59)).toBe(false);
    expect(isPaidInPart({ differenceKind: "none", createdAt: "2026-10-26T10:00:00Z" }, 83.59)).toBe(false);
    expect(isPaidInPart({ differenceKind: "debt", createdAt: "2026-10-26T10:00:00Z" }, 0)).toBe(false);
  });
});
