import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Correcting the customer on an order that was entered under the wrong name.
 *
 * The old rule refused any order that carried a charge. That cost nothing
 * while a fresh order carried none — but since charging-at-entry (75b3838)
 * every order is charged the moment it is typed, so the rule quietly made a
 * dropdown typo uncorrectable for the rest of the order's life.
 *
 * The fix is not to weaken the guard but to do the accounting move: take the
 * charge off the old customer, put it on the new one, and take the parcels
 * along. What genuinely cannot be moved is still refused.
 */

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = src.indexOf(to, start + from.length);
  expect(end, `marker not found: ${to}`).toBeGreaterThan(start);
  const out = src.slice(start, end);
  expect(out.length, "slice is empty").toBeGreaterThan(100);
  return out;
}

const router = read("server/routers/fullPackage.router.ts");
const move = slice(router, "// 2a. Customer reassignment.", "// 2b. Order-number uniqueness");

describe("a charge no longer makes a typo permanent", () => {
  it("being charged is not, by itself, a refusal", () => {
    // The old blanket test is gone.
    expect(move).not.toContain("const financiallyClean =");
    expect(move).not.toContain("!existing.isCharged &&");
  });

  it("a charged order is marked for moving instead", () => {
    expect(move).toContain("chargeToMove = {");
    expect(move).toContain("if (existing.isCharged || (existing as any).chargeTransactionId)");
  });
});

describe("what still cannot be moved", () => {
  it("an advance, because that is real money from the old customer", () => {
    expect(move).toContain("const hasAdvance =");
    expect(move).toContain("پارەی پێشەکی لەم ئۆردەرەدا وەرگیراوە");
  });

  it("an order sitting in a delivery box", () => {
    expect(move).toContain("isFPOrderBoxedNonCancelled(id)");
    expect(move).toContain("لە بۆکسی گەیاندندایە");
  });

  it("a parcel already charged at batch delivery", () => {
    expect(move).toContain("p.isCharged || p.isShippingCharged");
    expect(move).toContain("پێشتر چارج کراوە بۆ کڕیارە کۆنەکە");
  });
});

describe("the money moves in the safe order", () => {
  const body = slice(router, "// 5b. Move the money with the order.", "// 7b. Finish the move");

  it("the old customer is credited before anything else happens", () => {
    expect(body).toContain("db.reverseCharge(");
    const reverseAt = body.indexOf("db.reverseCharge(");
    const persistAt = body.indexOf("db.updateFullPackageOrder(id, data, ctx.user.id)");
    expect(persistAt).toBeGreaterThan(-1);
    expect(reverseAt).toBeLessThan(persistAt);
  });

  it("a failed reversal stops the edit rather than moving the order anyway", () => {
    const block = slice(router, "// 5b. Move the money with the order.", "// 6. Handle advance payment delta");
    expect(block).toContain('code: "INTERNAL_SERVER_ERROR"');
    expect(block).toContain("throw new TRPCError");
  });

  it("the charge stamps are cleared, so the re-charge is not refused", () => {
    const block = slice(router, "// 5b. Move the money with the order.", "// 6. Handle advance payment delta");
    expect(block).toContain("isCharged: false");
    expect(block).toContain("chargeTransactionId: null");
  });

  it("the new customer is charged through the one shared path", () => {
    const after = slice(router, "// 7b. Finish the move", "// `existing` is the getById row");
    expect(after).toContain("db.chargeOrderAtCreation(moved, ctx.user.id)");
    // Never a second hand-rolled applyCharge for the same goods.
    expect(after).not.toContain("applyCharge(");
  });

  it("the parcels follow their order", () => {
    const after = slice(router, "// 7b. Finish the move", "// `existing` is the getById row");
    expect(after).toContain("db.updatePackage(packageId, { customerId: customerId! })");
  });

  it("the move happens after the save, never before it", () => {
    const persistAt = router.indexOf("db.updateFullPackageOrder(id, data, ctx.user.id)");
    const moveAt = router.indexOf("// 7b. Finish the move");
    expect(persistAt).toBeGreaterThan(-1);
    expect(moveAt).toBeGreaterThan(persistAt);
  });
});

describe("the row's version is reported honestly", () => {
  it("it is read back, not guessed, because a move writes twice", () => {
    expect(router).toContain("const saved = await db.getFullPackageOrderById(id);");
    expect(router).toContain("newVersion: saved?.version ?? (existing.version ?? 1) + 1,");
  });
});
