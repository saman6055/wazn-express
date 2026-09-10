import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A box is paid when the payment screen says so.
 *
 * 2026-09-10: BOX-20260903-001 was paid in full on the payment screen ($24.75,
 * what each parcel was actually charged) and still flashed "handed over
 * unpaid — $0.02" and stayed out of the archive, because the list compared
 * the money with the item prices the box was built with ($24.77). One SQL now
 * reads the payment screen's own verdict, and the archive, the flash and the
 * paid label for staff and customer all read it. It only adds: a box the
 * screen did not clear is judged by the amounts exactly as before. Its
 * behaviour was checked against a real MySQL before it shipped.
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

describe("one verdict, read from the payment records", () => {
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

  it("refuses a box with any item not on a confirmed, not-held line", () => {
    expect(fn).toContain("NOT EXISTS");
    expect(fn).toContain("${l.isHeld} = 0");
  });
});

describe("everything that says paid or owed reads it", () => {
  const list = between(dbSrc, "export async function getAllDeliveryBoxes(", "\nexport async function");

  it("the archive, added beside the old rule", () => {
    expect(list).toContain("OR ${boxSettlementClearedSql()}");
    expect(list).toContain("${settledSql} + ${SETTLED_SLACK_USD} >= ${deliveryBoxes.totalValueUsd}");
  });

  it("the staff list rows, for the flash", () => {
    expect(list).toContain("settlementCleared:");
    expect(read("client/src/lib/boxAlert.ts")).toContain("if (box.settlementCleared === true) return null;");
  });

  it("the customer's and the office's box rows, for the paid label", () => {
    expect(between(dbSrc, "export async function getCustomerVisibleBoxes(", "\nexport async function")).toContain("settlementCleared:");
    expect(read("client/src/pages/portal/PortalFinancial.tsx")).toContain("boxPaidState(b.settledUsd, b.totalValueUsd, b.settlementCleared)");
    expect(read("client/src/pages/CustomerFinance.tsx")).toContain("boxPaidState(b.settledUsd, b.totalValueUsd, b.settlementCleared)");
  });
});
