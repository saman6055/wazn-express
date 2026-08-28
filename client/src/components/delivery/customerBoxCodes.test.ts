import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { FINISHED_BOX_STATUSES } from "@shared/archive";

/**
 * The delivery screen was a flat list of boxes, twenty to a page, ordered by
 * when they were made. That is the right shape for auditing the day and the
 * wrong shape for the counter, where the question is always the same: a
 * customer is standing there, they have given their code, and everything of
 * theirs has to appear — not one box on page one and another on page three.
 */

const ROOT = path.join(__dirname, "..", "..", "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const card = read("client/src/components/delivery/CustomerBoxCodes.tsx");
const page = read("client/src/pages/CustomerDeliveryScanner.tsx");
const boxesDb = read("server/db/deliveryBoxes.db.ts");
const router = read("server/routers/scanning.router.ts");

function slice(src: string, start: string, end: string, label: string): string {
  const a = src.indexOf(start);
  expect(a, `${label}: "${start}" not found`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `${label}: "${end}" not found after start`).toBeGreaterThan(a);
  const body = src.slice(a, b);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

const summary = () =>
  slice(boxesDb, "export async function getDeliveryBoxCustomerSummary", "\n}\n", "summary");

describe("the counter question is answered by customer, not by box", () => {
  it("groups on the server, because the table is paginated", () => {
    // Counting the twenty rows the page happens to be showing would give a
    // different answer on every page — and the wrong one on all of them.
    const body = summary();
    expect(body).toContain("groupBy(");
    expect(body).toContain("deliveryBoxes.customerId");
  });

  it("counts what is waiting apart from what is finished", () => {
    const body = summary();
    expect(body).toContain("openBoxes");
    expect(body).toContain("finishedBoxes");
  });

  it("uses the same definition of finished as the table does", () => {
    // The SQL has to spell the statuses out; this is what stops the two
    // drifting apart silently.
    const body = summary();
    for (const status of FINISHED_BOX_STATUSES) {
      expect(body, `${status} is missing from the SQL`).toContain(`'${status}'`);
    }
    const inSql = body.match(/IN \('([a-z,']+)'\)/)?.[1]?.split("','") ?? [];
    expect(inSql.sort()).toEqual([...FINISHED_BOX_STATUSES].sort());
  });

  it("totals only the boxes still waiting", () => {
    // The figure beside a code says how much is waiting, not how much has
    // ever passed through.
    const body = summary();
    const totals = body.slice(body.indexOf("totalPackages:"));
    expect(totals).toContain("NOT IN ('delivered','cancelled')");
  });

  it("returns a stable order rather than whatever the group by gave", () => {
    expect(summary()).toContain("localeCompare");
  });

  it("survives a failure without taking the screen with it", () => {
    const body = summary();
    expect(body).toContain("catch");
    expect(body).toContain("return [];");
  });
});

describe("pressing a code shows that customer and nothing else", () => {
  it("filters the table through the query the server already supports", () => {
    // Not a client-side filter over the current page: the boxes being looked
    // for may be on a page that was never fetched.
    expect(page).toContain("params.customerId = drilledCustomerId");
  });

  it("goes back to the first page", () => {
    // Staying on page three of the old list shows an empty table, which
    // reads as "this customer has no boxes".
    const body = slice(page, "const handleDrillToCustomer", "}, []);", "drill handler");
    expect(body).toContain("setCurrentPage(0)");
  });

  it("includes their finished boxes, which they may be asking about", () => {
    const body = slice(page, "const handleDrillToCustomer", "}, []);", "drill handler");
    expect(body).toContain("setShowArchivedBoxes(true)");
  });

  it("refetches when the drill changes", () => {
    // The query params memo has to depend on it, or the table keeps showing
    // the previous customer's boxes.
    expect(page).toContain("[filters, currentPage, drilledCustomerId]");
  });

  it("offers a way back that is visible while the filter is on", () => {
    // A filter with no visible handle is one somebody forgets is on, and
    // then reports the list as broken.
    expect(card).toContain('data-testid="customer-box-codes-clear"');
    expect(card).toContain("onSelect(null)");
  });

  it("closes on a second press of the open code", () => {
    expect(card).toContain("onSelect(isSelected ? null : row.customerId)");
  });
});

describe("the card stays readable as the list grows", () => {
  it("keeps a customer visible while they are being looked at", () => {
    // Delivering their last box must not make the tile vanish from under
    // the cursor.
    expect(card).toContain("r.openBoxes > 0 || r.customerId === selectedCustomerId");
  });

  it("offers a search once there are too many codes to scan by eye", () => {
    expect(card).toContain("waiting.length > SEARCH_THRESHOLD");
    expect(card).toContain("r.customerCode ?? \"\").toLowerCase().includes(q)");
  });

  it("shows a first screenful and lets the rest be asked for", () => {
    expect(card).toContain("COLLAPSED_COUNT");
    expect(card).toContain('data-testid="customer-box-codes-toggle"');
  });

  it("names the code left-to-right whatever the interface language", () => {
    // AZ047 is a code, not a word; RTL would reorder it.
    const tile = slice(card, "font-mono text-base font-semibold", "</span>", "code tile");
    expect(tile).toContain('dir="ltr"');
  });
});

describe("the procedure is mounted and reachable", () => {
  it("exists on the delivery box router", () => {
    expect(router).toContain("customerSummary: staffProcedure");
    expect(router).toContain("db.getDeliveryBoxCustomerSummary()");
  });

  it("is read-only", () => {
    const body = slice(router, "customerSummary: staffProcedure", "// Update box details", "procedure");
    expect(body).toContain(".query(");
    expect(body).not.toContain(".mutation(");
  });

  it("is staff-only, like everything else on this screen", () => {
    expect(router).toContain("customerSummary: staffProcedure");
  });
});

/**
 * Where it sits, after the owner said it should have been one icon.
 *
 * It opened as a grid of every code on the delivery screen, above the list of
 * boxes, and between it and the discount report the list itself was pushed
 * off the first screen. An icon opens a window; the window has the codes.
 */
describe("it is one icon, and then a window", () => {
  it("is reached from a single button carrying the count", () => {
    expect(page).toContain('data-testid="open-customer-codes"');
    expect(page).toContain("waitingCodes");
  });

  it("opens in its own window rather than on the page", () => {
    expect(page).toContain("<CustomerBoxCodes");
    expect(page).toContain("inDialog");
  });

  it("closes itself once a code is picked", () => {
    // The window did its job; leaving it open hides the list it just filtered.
    expect(page).toContain("setCodesOpen(false)");
  });

  it("drops its own heading and frame inside the window", () => {
    // A card inside a dialog, with the title written twice.
    expect(card).toContain("const Frame = inDialog");
    expect(card).toContain("{!inDialog && (");
  });

  it("always offers the search there, because that is why it was opened", () => {
    expect(card).toContain("(inDialog || waiting.length > SEARCH_THRESHOLD)");
    expect(card).toContain("autoFocus={inDialog}");
  });

  it("still shows which code the list is narrowed to, back on the page", () => {
    // The window is gone by then; without this the filter has no handle.
    expect(page).toContain('data-testid="clear-customer-drill"');
  });
});

/**
 * The codes could not be told apart.
 *
 * The stored value is `AZ047(Lubna Hikmat Dawood)` — an identifier with the
 * name folded in — and in a tile that width it truncated to "AZ04…". A grid
 * of "AZ08…", "AZ19…", "AZ21…" on the one screen whose entire job is telling
 * customers apart.
 */
describe("every code can be read at a glance", () => {
  it("prints the identifying half on a line of its own", () => {
    expect(card).toContain("splitCustomerCode(row.customerCode)");
    expect(card).toContain("{split.code || row.fullName");
  });

  it("does not truncate the code itself", () => {
    // The name is what may be cut; the code never is.
    const tile = slice(card, "font-mono text-base font-semibold", "</span>", "code line");
    expect(tile, "the code line must not truncate").not.toContain("truncate");
  });

  it("keeps the name, underneath, where there is room for it to be cut", () => {
    expect(card).toContain("{split.name || row.fullName}");
    expect(card).toContain("truncate text-xs");
  });

  it("names the person on hover, not the code twice over", () => {
    expect(card).toContain("[split.code, split.name || row.fullName]");
  });

  it("still finds somebody by name, because the search reads the whole value", () => {
    // customerCode carries the name, so searching "Lubna" still matches.
    expect(card).toContain('(r.customerCode ?? "").toLowerCase().includes(q)');
    expect(card).toContain('(r.fullName ?? "").toLowerCase().includes(q)');
  });
});
