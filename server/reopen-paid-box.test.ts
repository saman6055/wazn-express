import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Opening a box that was already finished (owner, 2026-09-22).
 *
 * He put four cases to me, and they are one case: a box closed by mistake,
 * one counted as paid on a promise that was not kept, one the customer is
 * adding more goods to, and one the office simply got wrong. "As an admin I
 * need to be able to open a box after it has been paid for."
 *
 * The rule that keeps this safe is that it moves the box and nothing else.
 * The money has its own door — a receipt is undone on the payment screen,
 * which is what puts the debt back — and undoing both from one button is how
 * a customer ends up paying twice, or not at all.
 *
 * What would undo it: the reopen touching money, the counter being able to do
 * it without being an admin, no reason recorded, or the delivery fee being
 * left ready to post a second time.
 */

const readRoot = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

const lifecycle = readRoot("server/lib/boxLifecycle.ts");
const router = readRoot("server/routers/scanning.router.ts");
const reopen = router.slice(router.indexOf("  reopen: staffProcedure"), router.indexOf("  // Mark box as in-transit"));
const step = lifecycle.slice(lifecycle.indexOf("export async function reopenDeliveredBox"), lifecycle.indexOf("export type FinishPaidBoxResult"));

describe("stepping a finished box back", () => {
  it("puts the box back to open and its parcels back to ready", () => {
    expect(step.length).toBeGreaterThan(300);
    expect(step).toContain('status: "ready_for_delivery",');
    expect(step).toContain("deliveredAt: null,");
    expect(step).toContain('status: "open",');
    // Only the parcels this box actually delivered.
    expect(step).toContain('if (!pkg || pkg.status !== "delivered") continue;');
  });

  it("touches no money at all", () => {
    for (const forbidden of ["reverseCharge", "adjustCharge", "reverseBoxSettlement", "recordPackageChargeWithoutInvoice", "createInvoice"]) {
      expect(step, forbidden).not.toContain(forbidden);
    }
    // isCharged stays as it was, so the delivery fee cannot post twice.
    expect(step).not.toContain("isCharged");
  });

  it("leaves the orders in the box alone — their money is their own", () => {
    expect(step).not.toContain("updateFullPackageOrder");
  });
});

describe("who may do it, and on what terms", () => {
  it("the counter keeps its old, harmless way back", () => {
    expect(reopen).toContain("if (box.status === 'ready' && !box.isCharged) {");
    expect(reopen).toContain("return db.updateDeliveryBox(input.id, { status: 'open', sealedAt: null, sealedById: null });");
  });

  it("anything further is for an admin, with a reason", () => {
    expect(reopen).toContain("if (ctx.user.role !== 'admin' && ctx.user.role !== 'super_admin') {");
    expect(reopen).toContain('if (reason.length < 3) {');
    expect(reopen).toContain("action: \"reopen_delivery_box\",");
    expect(reopen).toContain("parcelsSteppedBack: result.parcels");
  });

  it("a cancelled box is not a box to reopen", () => {
    expect(reopen).toContain("if (box.status === 'cancelled') {");
  });
});

describe("the screen", () => {
  const panel = readRoot("client/src/components/delivery/BoxDetailPanel.tsx");

  it("offers it only to an admin, and only on a box that has gone out", () => {
    expect(panel).toContain('const isAdmin = user?.role === "admin" || user?.role === "super_admin";');
    expect(panel).toContain("const canReopenFinished = isAdmin && (isInTransit || isDelivered ||");
  });

  it("says what will happen, and will not proceed without a reason", () => {
    expect(panel).toContain("REOPEN_WORDS.body");
    expect(panel).toContain("disabled={reopenReason.trim().length < 3 || reopenBox.isPending}");
    expect(panel).toContain("reopenBox.mutate(\n                  { id: boxId, reason: reopenReason.trim() },");
    // It names the other door rather than pretending this one does the money.
    expect(panel).toContain("واصڵەکە لە شاشەی پارەدانەوە هەڵبوەشێنەوە");
  });
});
