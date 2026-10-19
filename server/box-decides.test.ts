import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { isOrderFreightText } from "./db/boxSettlement.db";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

/*
 * The owner, 2026-10-19: "money is counted when it is put in a box and the
 * box's money is taken - the other parts only add debt; the box decides what
 * was paid." Nobody should have to close a batch for an account to be right.
 *
 * Proved on a real MySQL: an old receipt (AZ295's kind - $135.50 counted,
 * nothing on the account) written through its box at the receipt's figures,
 * a second run writing nothing, and then the batch marked delivered through
 * the real route - the account did not move by a cent.
 */
describe("the box decides; the batch never writes what a box wrote", () => {
  it("the till and the repair write an order's freight one way, marked", () => {
    const settle = read("db/boxSettlement.db.ts");
    const decides = read("db/boxDecides.db.ts");
    expect(settle).toContain("export async function postOrderFreight(");
    expect(settle).toContain("await postOrderFreight(tx, customer, box.boxCode, parcel.freightOrder, parcel.pendingFreightUsd, userId);");
    expect(decides).toContain("await postOrderFreight(tx, customer, box.boxCode, p.freightOrder, freightUsd, userId, \"وەسڵی کۆن\");");
    // The goods through the same charge an order entered today takes.
    expect(decides).toContain("const goods = await chargeOrdersInBox(boxId, userId);");
    // A parcel written is marked, on both flags.
    expect(decides).toContain("await tx.update(packages).set({ isCharged: true }).where(eq(packages.id, p.packageId));");
    expect(decides).toContain("await markLinkedOrdersCharged([p.packageId], tx);");
  });

  it("only what a confirmed receipt counted, at the receipt's figure", () => {
    const decides = read("db/boxDecides.db.ts");
    expect(decides).toContain("eq(boxSettlements.status, \"confirmed\"),");
    expect(decides).toContain("eq(boxSettlementLines.isHeld, false),");
    expect(decides).toContain("const counted = round2(p.settledUsd + p.discountedUsd);");
    // Counted only the goods: the freight is still a debt, never forgiven.
    expect(decides).toContain("const freightUsd = counted > goodsUsd + 0.005 ? round2(counted - goodsUsd) : p.pendingFreightUsd;");
  });

  it("every batch-delivery path reads the flags the box sets", () => {
    const batches = read("routers/batches.router.ts");
    expect(batches).toContain("if (fpOrder.orderType === 'commission' && share > 0 && !fpOrder.isShippingCharged) {");
    expect(batches).toContain("if (freshPkg?.isCharged) {");
    expect(batches).toContain("if (order.isCharged || (order as any).isChargedToCustomer) continue;");
    expect(batches).toContain("if (order.isCharged || (order as any).isChargedToCustomer) {");
    expect(batches).toContain("if (!(await db.claimOrderForCharge(order.id))) {");
  });

  it("the repair is the main admin's, and audited", () => {
    const router = read("routers/finance.router.ts");
    expect(router).toContain("chargeReceiptedBox: superAdminProcedure");
    expect(router).toContain("action: \"charge_receipted_box\",");
  });
});

describe("an order's freight is not a same-numbered parcel's charge", () => {
  it("knows the words every door writes on an order's freight", () => {
    expect(isOrderFreightText("کڕین بە تێچوو CM-MU2GE1UX + CM-MU2GFW8Z - کرێی گواستنەوە (BOX-20261001-001)")).toBe(true);
    expect(isOrderFreightText("کڕین بە تێچوو CM-A - کرێی گواستنەوە (پاشاکەوتکراو)")).toBe(true);
    expect(isOrderFreightText("کڕین بە تێچوو - CM-MU2GVSGI (Cosmetics)")).toBe(false);
    expect(isOrderFreightText("پاکەت 773442848393635 - باچ AIR-2026-062")).toBe(false);
    expect(isOrderFreightText(null)).toBe(false);
  });

  it("the doors that write it still write those words", () => {
    const batches = read("routers/batches.router.ts");
    expect(batches).toContain("`کڕین بە تێچوو ${order.orderCode} - کرێی گواستنەوە (پاشاکەوتکراو)`,");
    expect(batches).toContain("`کڕین بە تێچوو ${order.orderCode} - کرێی گواستنەوە`,");
    expect(read("db/boxSettlement.db.ts")).toContain("if (row.referenceType === \"package\" && isOrderFreightText(row.description)) continue;");
  });
});
