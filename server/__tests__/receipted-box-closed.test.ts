/**
 * A receipted box is settled - nobody owes for it (owner's hard rule).
 *
 * Owner, 2026-10-26: 23 paid boxes stood in «پارە نەدراو» for $3,200 never
 * owed. An old box's goods were on the account twice (the order's price and
 * the 10/09 receipt's line), or freight was written after the receipt took
 * it, and the till added both up. The box's own receipt now closes it.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("a receipt closes its box", () => {
  const settle = read("server/db/boxSettlement.db.ts");

  it("the latest confirmed receipt decides; one that kept the rest as debt leaves the box asking", () => {
    expect(settle).toContain("async function boxesClosedByReceipt(");
    expect(settle).toContain('eq(boxSettlements.status, "confirmed")));');
    expect(settle).toContain('latest.forEach((r, boxId) => { if (r.differenceKind !== "debt") out.add(boxId); });');
  });

  it("a closed box's parcels owe nothing and post no more freight", () => {
    expect(settle).toContain("const settledUsd = closed ? Math.max(openSettledUsd, round2(chargedUsd - discountedUsd)) : openSettledUsd;");
    expect(settle).toContain("if (closed) { pendingFreightUsd = 0; freightOrder = null; }");
  });

  it("the repair of an old receipt still reads the ledger raw", () => {
    expect(settle).toContain("const closedBoxes = opts.raw ? new Set<number>() : await boxesClosedByReceipt(db, boxIds);");
    expect(read("server/db/boxDecides.db.ts")).toContain("getBoxSettlementView(boxId, { raw: true })");
  });
});

describe("an advance pays goods the account holds (2026-10-28)", () => {
  const settle = read("server/db/boxSettlement.db.ts");
  it("goods and freight of an order are told apart", () => {
    expect(settle).toContain('if (row.referenceType !== "package") orderGoods.set(id,');
  });
  it("an order on the account sets its advance only against its goods; one not on it, as before", () => {
    expect(settle).toContain("advanceCents += Math.round((orderSeen.has(id) ? Math.min(advanceUsd, Math.max(0, orderGoods.get(id) ?? 0)) : advanceUsd) * 100);");
  });
});

describe("living boxes know each other at the till (2026-10-29)", () => {
  const settle = read("server/db/boxSettlement.db.ts");
  it("the view says what the older living boxes still have to write", () => {
    expect(settle).toContain("earlierUnwrittenUsd: unwritten.totalUsd };");
  });
  it("the receipt asks against it and writes it, so the account never reads the advance as a credit", () => {
    expect(settle).toContain("othersUnwrittenUsd: view.earlierUnwrittenUsd,");
    expect(settle).toContain("const { lines: older } = await unwrittenOfBoxes(earlierIds, tx);");
    // Claimed before written: two tills at once write the older freight once.
    expect(settle).toContain("COALESCE(${fullPackageOrders.isShippingCharged}, 0) = 0");
  });
  it("every screen asks the same figure", () => {
    for (const f of ["client/src/components/delivery/QuickSettleDialog.tsx", "client/src/components/delivery/BoxSettlementPanel.tsx", "client/src/components/delivery/ReceiptDinarDialog.tsx"]) {
      expect(read(f)).toContain("othersUnwrittenUsd: ");
    }
  });
});
