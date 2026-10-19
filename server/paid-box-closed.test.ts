import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8").replace(/\r\n/g, "\n");

/*
 * Owner, 2026-10-19: "a box whose payment was taken is finished - nothing is
 * left in its life. Only when it was paid by mistake may it go back to before
 * the payment, by the main admin, with a reason, and everywhere."
 * AZ295 BOX-20261001-001: receipted on 07/10 with no money, a parcel added on
 * 19/10. Proved on real MySQL: in and out refused, an admin refused, the main
 * admin without a reason refused; with one, the receipt undone, the box open,
 * the debt back - and only then a parcel goes in.
 */
describe("a paid box is closed", () => {
  it("nothing goes in or comes out while a receipt stands", () => {
    const boxes = read("db/deliveryBoxes.db.ts");
    expect(boxes).toContain("export async function refuseIfBoxPaid(boxId: number): Promise<void> {");
    expect(boxes).toContain("  await refuseIfBoxPaid(Number(data.boxId));");
    expect(boxes).toContain("  await refuseIfBoxPaid(Number(item.boxId));");
    expect(boxes).toContain("  await refuseIfBoxPaid(boxId);");
  });

  it("only the main admin undoes a receipt or takes a paid box back, all the way", () => {
    const router = read("routers/scanning.router.ts");
    expect(router).toContain("reverseSettlement: superAdminProcedure");
    expect(router).toContain("const receipts = await db.liveReceiptsOfBox(input.id);");
    expect(router).toContain("if (ctx.user.role !== 'super_admin') {");
    expect(router).toContain("await db.reverseBoxSettlement(r.id, `کردنەوەی بۆکس بۆ پێش پارەدان: ${why}`, ctx.user.id);");
    // Before the counter's own way back for a sealed box.
    expect(router.indexOf("const receipts = await db.liveReceiptsOfBox(input.id);")).toBeLessThan(router.indexOf("if (box.status === 'ready' && !box.isCharged) {"));
  });

  it("the screen says so and hides what would be refused", () => {
    const panel = read("../client/src/components/delivery/BoxDetailPanel.tsx");
    expect(panel).toContain("{isOpen && !hasLiveReceipt && (");
    expect(panel).toContain("{isReady && !hasLiveReceipt && (");
    expect(panel).toContain("REOPEN_WORDS.paidBody");
    expect(read("../client/src/components/delivery/BoxSettlementPanel.tsx")).toContain(") : isMainAdmin && (");
    expect(read("../client/src/components/delivery/QuickSettleDialog.tsx")).toContain("{isMainAdmin && <Button");
  });
});
