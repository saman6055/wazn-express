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
    // The ledger's tabs carry the address "see every row" leads to (DebtPeel).
    const ledger = page.indexOf('<Tabs defaultValue="transactions" id={ACCOUNT_LINES_ANCHOR}');
    expect(ledger).toBeGreaterThan(-1);
    expect(card).toBeLessThan(ledger);
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

/**
 * The owner, 2026-10-10: "whatever I press here should give me the complete,
 * exact detail - any number, peeled like an onion". Every figure on the card
 * opens the rows it was added up from (components/customers/DebtPeel; the
 * sums are in shared/debtPeel.test).
 */
describe("every figure on the card opens", () => {
  const card = fs.readFileSync(path.resolve(__dirname, "components/customers/CustomerDebtExplained.tsx"), "utf8").replace(/\r\n/g, "\n");
  const peel = fs.readFileSync(path.resolve(__dirname, "components/customers/DebtPeel.tsx"), "utf8").replace(/\r\n/g, "\n");
  const server = fs.readFileSync(path.resolve(__dirname, "../../server/db/boxPaidStillOwed.db.ts"), "utf8").replace(/\r\n/g, "\n");

  it("really owed, written twice and what the account shows are each a row that opens", () => {
    for (const id of ["debt-still-owed-row", "debt-false-row", "debt-account-row"]) expect(card, id).toContain(`testId="${id}"`);
    expect(card).toContain("<OwedSumPanel");
    expect(card).toContain("<DoublePanel lines={data.double.lines} twiceUsd={data.double.twiceUsd} falseDebtUsd={data.falseDebtUsd} />");
    expect(card).toContain("<AccountSumsPanel sums={data.sums}");
  });

  it("each owed thing shows the rows of the account behind its amount", () => {
    expect(card).toContain('data-testid="debt-item-story"');
    expect(card).toContain("{storyOf === item.key && <StoryLines lines={item.story} figureUsd={item.usd} />}");
  });

  it("the lines are the account's own rows - the server sends them, nothing is priced on the screen", () => {
    expect(server).toContain("story: chargeStory(got.rows, item.chargeIds)");
    expect(server).toContain("sums: accountSums(got.rows, got.balanceUsd),");
    expect(peel).not.toMatch(/\.reduce\([^)]*amountUsd/);
  });

  it("a list that does not come to its figure says so", () => {
    expect(peel).toContain('data-testid="peel-mismatch"');
    expect(peel.split("<Mismatch ").length - 1).toBeGreaterThanOrEqual(3);
  });

  it("the state for it is declared before the early returns", () => {
    expect(card.indexOf("const [peel, setPeel]")).toBeLessThan(card.indexOf('if (isLoading) return <Skeleton'));
    expect(card.indexOf("const [storyOf, setStoryOf]")).toBeLessThan(card.indexOf('if (isLoading) return <Skeleton'));
  });
});
