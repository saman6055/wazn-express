import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A tracking that is already in a paid box is never taken again.
 *
 * The owner, 2026-09-24: "a duplicate tracking must not be accepted in any
 * way. If a tracking went into a box and that box was paid, settled and
 * closed, it still must not be accepted — and it must send a warning with
 * detail: the box, the money, the delivery time, the code and the parcel's
 * price." And the way out, in his words: "the only way is to reopen that box
 * and take it out of it; write that in the warning too."
 *
 * The refusal already existed and named the box. What it did not do was say
 * what it knew, or say what to do — and the screen treated it as the routine
 * double-scan and let it fade in three seconds.
 */

const readRoot = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

const db = readRoot("server/db/boxSettlement.db.ts");
const router = readRoot("server/routers/scanning.router.ts");
const refusal = router.slice(router.indexOf("const paidElsewhere = await db.findPaidBoxHolding("), router.indexOf("// Labels for description breakdown"));

describe("what the lookup brings back", () => {
  it("the box, its state, the day it went out, the money and the parcel's own price", () => {
    expect(db).toContain("export interface PaidBoxHolding {");
    for (const field of ["boxCode", "status", "deliveredAt", "paidUsd", "settledAt", "packageCode", "itemPriceUsd"]) {
      expect(db, field).toContain(`${field}:`);
    }
    // Reversed receipts are not money that was kept.
    expect(db).toContain('ne(boxSettlements.status, "reversed")');
  });
});

describe("the refusal", () => {
  it("says all of it", () => {
    expect(refusal).toContain("بۆکس ${paidElsewhere.boxCode}");
    expect(refusal).toContain("کۆدی پاکەت ${paidElsewhere.packageCode}");
    expect(refusal).toContain("نرخی پاکەت $${paidElsewhere.itemPriceUsd.toFixed(2)}");
    expect(refusal).toContain("پارەی دراو $${paidElsewhere.paidUsd.toFixed(2)}");
    expect(refusal).toContain("بەرواری پارەدان");
    expect(refusal).toContain("بەرواری گەیاندن");
  });

  it("says the way out, in order", () => {
    expect(router).toContain('import { withFix } from "@shared/fixAdvice";');
    expect(refusal).toContain("withFix(");
    expect(refusal).toContain("بکەرەوە");
    expect(refusal).toContain("پاکەتەکە لەو بۆکسە دەربهێنە");
    expect(refusal).toContain("ئینجا لێرە دووبارە سکانی بکە");
  });

  it("stops the screen instead of fading away with the routine double-scans", () => {
    expect(refusal).toContain('code: "PRECONDITION_FAILED"');
    // The screen's own rule: only a CONFLICT is the quiet one.
    const panel = readRoot("client/src/components/delivery/BoxDetailPanel.tsx");
    expect(panel).toContain('const routine = err.data?.code === "CONFLICT";');
  });

  it("and the steps arrive as steps, not as one paragraph", () => {
    const alert = readRoot("client/src/components/SystemAlert.tsx");
    expect(alert).toContain('<p className="whitespace-pre-line">{current.message}</p>');
  });
});
