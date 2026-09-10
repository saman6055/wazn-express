import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A box is paid when the payment screen says so — and then it leaves the list.
 *
 * 2026-09-10: BOX-20260903-001 was paid in full on the payment screen ($24.75,
 * what each parcel was actually charged) and still flashed "handed over
 * unpaid — $0.02" and stayed out of the archive, because the list compared
 * the money with the item prices the box was built with ($24.77). Then
 * BOX-20260827-001: the screen said nothing was left, the box stayed listed.
 *
 * The payment screen's per-parcel sums now live in one function
 * (parcelsForItems). The screen calls it for one box; getBoxesPaidInFull
 * calls it for many and applies finishPaidBox's own test. The list's archive,
 * the unpaid flash and the paid label for staff and customer all read that.
 * A cheap SQL rule (boxSettlementClearedSql) runs first on every box; the
 * exact check covers the paid boxes it misses. Both only add: a box neither
 * clears is judged by the amounts exactly as before. Checked against a real
 * MySQL before shipping, including a before/after comparison of what the
 * payment screen shows.
 */

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

function between(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `end marker not found after ${start}: ${end}`).toBeGreaterThan(-1);
  return src.slice(a, b);
}

const dbSrc = read("server/db/deliveryBoxes.db.ts");
const settleSrc = read("server/db/boxSettlement.db.ts");
const PAID_TEST = "lines.length > 0 && lines.every((p) => Number(p.outstandingUsd) <= SETTLED_SLACK_USD)";

describe("the list and the payment screen use the same sums", () => {
  it("the payment screen gets its parcels from parcelsForItems", () => {
    const view = between(settleSrc, "export async function getBoxSettlementView(", "\n}\n");
    expect(view).toContain("const parcels = await parcelsForItems(db, items);");
    expect(view).not.toContain("CHARGE_TYPES");
  });

  it("the batched check uses the same sums and finishPaidBox's own test", () => {
    const fn = between(settleSrc, "export async function getBoxesPaidInFull(", "\n}\n");
    expect(fn).toContain("parcelsForItems(db, items)");
    expect(fn).toContain("eq(boxSettlements.status, \"confirmed\")");
    expect(fn).toContain(PAID_TEST);
    const finish = between(read("server/lib/boxLifecycle.ts"), "export async function finishPaidBox(", "\n}\n");
    expect(finish).toContain(PAID_TEST);
  });
});

describe("the cheap rule, read from the payment records", () => {
  const fn = between(dbSrc, "export function boxSettlementClearedSql()", "\n}\n");

  it("needs a confirmed payment", () => {
    expect(fn).toContain("= 'confirmed'");
  });

  it("refuses a latest payment left short as debt", () => {
    expect(fn).toContain("= 'debt' THEN 0");
    expect(fn).toContain("ORDER BY ${s.id} DESC LIMIT 1");
  });

  it("checks the amount on a payment recorded with no difference", () => {
    expect(fn).toContain("= 'none' THEN (${s.paidUsd} + ${SETTLED_SLACK_USD} >= ${s.dueUsd})");
  });

  it("refuses a box with any item not on a confirmed, not-held line of its own payments", () => {
    expect(fn).toContain("NOT EXISTS");
    expect(fn).toContain("WHERE ${s.boxId} = ${b.id} AND ${l.boxItemId} = ${i.id}");
    expect(fn).toContain("${l.isHeld} = 0");
  });
});

describe("everything that says paid or owed reads it", () => {
  const list = between(dbSrc, "export async function getAllDeliveryBoxes(", "\nexport async function");

  it("the archive: the old rule, the cheap rule, and the exact check for the rest", () => {
    expect(list).toContain("${settledSql} + ${SETTLED_SLACK_USD} >= ${deliveryBoxes.totalValueUsd}");
    expect(list).toContain("OR ${boxSettlementClearedSql()}");
    expect(list).toContain("await getBoxesPaidInFull(stillListed.map(");
    expect(list).toContain("archivedSql = sql`(${archivedSql} OR ${inArray(deliveryBoxes.id, paidIds)})`");
  });

  it("the rows, for the flash and the paid label, use the exact check", () => {
    expect(between(dbSrc, "export async function getBoxesSettlementCleared(", "\n}\n")).toContain("await getBoxesPaidInFull(boxIds)");
    expect(list).toContain("settlementCleared:");
    expect(read("client/src/lib/boxAlert.ts")).toContain("if (box.settlementCleared === true) return null;");
  });

  it("the customer's and the office's box rows, for the paid label", () => {
    expect(between(dbSrc, "export async function getCustomerVisibleBoxes(", "\nexport async function")).toContain("settlementCleared:");
    expect(read("client/src/pages/portal/PortalFinancial.tsx")).toContain("boxPaidState(b.settledUsd, b.totalValueUsd, b.settlementCleared)");
    expect(read("client/src/pages/CustomerFinance.tsx")).toContain("boxPaidState(b.settledUsd, b.totalValueUsd, b.settlementCleared)");
  });
});
