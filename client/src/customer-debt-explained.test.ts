import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The finance profile explains itself (owner, 2026-10-08): "it is very
 * confused. A transaction's detail has no tracking, no platform order
 * number, no photo of the order, no link to it."
 *
 * What would undo it: the profile losing the card that says what the debt
 * is for, a ledger row or its detail losing its subject, the client
 * deciding a verdict of its own, or the server's rule drifting from the one
 * the correction page uses.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the profile opens with what the debt is for", () => {
  const page = read("client/src/pages/CustomerFinance.tsx");

  it("the card sits above the ledger", () => {
    const card = page.indexOf("<CustomerDebtExplained customerId={customerId} />");
    expect(card).toBeGreaterThan(-1);
    expect(card).toBeLessThan(page.indexOf('<Tabs defaultValue="transactions">'));
  });

  it("every ledger row carries its subject: flat rows, grouped rows, and the detail", () => {
    expect(page.split("<LedgerSubjectLine subject={subjectOf(txn)} />").length - 1).toBe(3);
    expect(page).toContain("<LedgerSubjectCard subject={subjectOf(selectedTransaction)} />");
  });
});

describe("a subject shows the tracking, the order number, the photo and the doors", () => {
  const ui = read("client/src/components/customers/CustomerDebtExplained.tsx");

  it("tracking and order number are copyable, and the order number is the shared component", () => {
    expect(ui).toContain("<CopyButton value={subject.tracking} />");
    expect(ui).toContain("<OrderNumbers numbers={subject.orderNumber}");
  });

  it("the photo is the order's own thumbnail", () => {
    expect(ui).toContain("<OrderThumbs orders={[{ id: subject.orderId, hasImage: subject.hasImage }]}>");
  });

  it("the doors are the shared address rule and the box's own screen", () => {
    expect(ui).toContain('from "@shared/parcelSource"');
    expect(ui).toContain("parcelSourceTarget(");
    expect(ui).toContain("`/customer-delivery-scanner?box=${boxId}`");
  });

  it("a click on a subject does not open the row's detail under it", () => {
    const from = ui.indexOf("export function LedgerSubjectLine");
    const line = ui.slice(from, ui.indexOf("export function LedgerSubjectCard"));
    expect(line.length).toBeGreaterThan(400);
    expect(line).toContain("onClick={(e) => e.stopPropagation()}");
  });

  it("decides nothing itself: the four places and the false debt are the server's figures", () => {
    expect(ui).toContain("trpc.ledger.debtExplained.useQuery");
    expect(ui).toContain("data.owedUsd[bucket]");
    expect(ui).toContain("data.stillOwedUsd");
    expect(ui).toContain("data.falseDebtUsd");
    expect(ui).not.toContain("explainDebt(");
  });
});

describe("one rule behind the profile and the correction page", () => {
  const db = read("server/db/boxPaidStillOwed.db.ts");

  it("both read the same gathered account", () => {
    const explain = db.slice(db.indexOf("export async function explainCustomerDebt"));
    const still = db.slice(db.indexOf("export async function stillOwedByCustomer"), db.indexOf("export interface LedgerSubject"));
    expect(explain).toContain("await gatherAccount(customerId)");
    expect(still).toContain("await gatherAccount(customerId)");
    expect(explain).toContain("explainDebt(got.rows, got.facts)");
  });

  it("the false debt on the profile is the correction page's own figure", () => {
    expect(db).toContain("await findBoxDoubleCharges(customerId)");
  });

  it("a cancelled box settles nothing and holds nothing", () => {
    expect(db).toContain('ne(deliveryBoxes.status, "cancelled")');
  });

  it("the route is read-only and open to the staff who open the profile", () => {
    const router = read("server/routers/finance.router.ts");
    const at = router.indexOf("debtExplained: staffProcedure");
    expect(at).toBeGreaterThan(-1);
    expect(router.slice(at, at + 220)).toContain(".query(");
  });
});
