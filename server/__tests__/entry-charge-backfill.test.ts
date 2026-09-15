import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Bringing the orders entered before the rule into line with it (the owner,
 * 2026-09-15: "make the changes cover the ones entered since 1 September").
 *
 * This writes real debt onto real customers' accounts, so the guards here are
 * about the two things that make that safe: the office reads the list before
 * anything moves, and running it twice cannot bill anybody twice.
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

describe("nothing moves because a screen was opened", () => {
  const router = read("server/routers/fullPackage.router.ts");

  it("the preview is a query and the apply is a mutation", () => {
    expect(router).toContain("previewEntryChargeBackfill: adminProcedure");
    expect(router).toContain("applyEntryChargeBackfill: adminProcedure");
    const preview = slice(router, "previewEntryChargeBackfill: adminProcedure", "applyEntryChargeBackfill: adminProcedure");
    expect(preview).toContain(".query(");
    expect(preview).not.toContain(".mutation(");
    // And the read path must not be able to write.
    expect(preview).not.toContain("applyEntryChargeBackfill(");
    expect(preview).not.toContain("applyCharge");
  });

  it("both doors are admin-only", () => {
    expect(router).not.toContain("previewEntryChargeBackfill: staffProcedure");
    expect(router).not.toContain("applyEntryChargeBackfill: staffProcedure");
  });

  it("the apply leaves an audit entry", () => {
    const apply = slice(router, "applyEntryChargeBackfill: adminProcedure", "relinkAllOrderPackages: adminProcedure");
    expect(apply).toContain("createAuditLog");
    expect(apply).toContain("backfill_order_entry_charges");
  });
});

describe("running it twice bills nobody twice", () => {
  const dbsrc = read("server/db/fullPackage.db.ts");

  it("the apply charges through the same path a new order takes", () => {
    const apply = slice(dbsrc, "export async function applyEntryChargeBackfill", "/**\n * Stamp the charge");
    expect(apply).toContain("chargeOrderAtCreation(order, userId)");
    // Never its own copy of applyCharge — that is how two paths drift.
    expect(apply).not.toContain("applyCharge(");
  });

  it("the search skips anything already charged", () => {
    const find = slice(dbsrc, "export async function findOrdersAwaitingEntryCharge", "export async function applyEntryChargeBackfill");
    expect(find).toContain("eq(fullPackageOrders.isCharged, false)");
    expect(find).toContain("isNull(fullPackageOrders.chargeTransactionId)");
  });
});

describe("what is never billed", () => {
  const dbsrc = read("server/db/fullPackage.db.ts");
  const find = slice(dbsrc, "export async function findOrdersAwaitingEntryCharge", "export async function applyEntryChargeBackfill");

  it("a quote, because nobody has agreed to it", () => {
    expect(find).toContain('ne(fullPackageOrders.orderType, "purchase_request")');
  });

  it("an order with no goods in the customer's hands", () => {
    for (const status of ["cancelled", "rejected", "refunded", "returned"]) {
      expect(dbsrc).toContain(`"${status}"`);
    }
    expect(find).toContain("notInArray(fullPackageOrders.status, BACKFILL_EXCLUDED_STATUSES)");
  });

  it("a row the office deleted on purpose", () => {
    expect(find).toContain("isNull(fullPackageOrders.deletedAt)");
  });

  it("a zero — a $0 debit is noise on a statement", () => {
    expect(find).toContain("if (!(amountUsd > 0)) continue;");
  });

  it("the amount is the one shared rule", () => {
    expect(find).toContain("computeOrderChargeAmount(r.order)");
  });
});

describe("the screen says what will happen before it happens", () => {
  const ui = read("client/src/components/admin/EntryChargeBackfillSection.tsx");

  it("the button is behind a confirmation naming the total", () => {
    expect(ui).toContain("AlertDialog");
    expect(ui).toContain("money(data.totalUsd)");
    expect(ui).toContain("setConfirmOpen(true)");
  });

  it("it refuses to run when the preview found nothing", () => {
    expect(ui).toContain("data.totalOrders === 0");
  });
});
