import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's rule (Sep 2026): once a box's money is in, nothing inside it
 * may be charged again in another box.
 *
 * The hole this closes: `isPackageInAnyBox` / `isFPOrderInAnyBox` match only
 * open, ready and in-transit boxes, and a paid box is none of those —
 * `finishPaidBox` seals it and marks it delivered. Source-text guards, like
 * the other box-money tests, because the path needs a live database.
 */

const ROOT = path.resolve(__dirname, "../..");

const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

/** The source between two markers, with both ends proven to exist. */
function slice(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = src.indexOf(to, start + from.length);
  expect(end, `marker not found: ${to}`).toBeGreaterThan(start);
  const out = src.slice(start, end);
  expect(out.length, "slice is empty").toBeGreaterThan(100);
  return out;
}

describe("a paid parcel is never billed in a second box", () => {
  const scan = read("server/routers/scanning.router.ts");
  const addItem = slice(scan, "addItem: staffProcedure", "const item = await db.addItemToBox({");

  it("the scanner asks the paid-box rule before it adds anything", () => {
    expect(addItem).toContain("findPaidBoxHolding");
    // The refusal must happen BEFORE the item is written, not after.
    expect(addItem).toContain("code: \"CONFLICT\"");
  });

  it("the refusal names the box, so the counter can go and look", () => {
    expect(addItem).toContain("paidElsewhere.boxCode");
  });

  it("it asks about the tracking, not just the parcel row", () => {
    // A shared carton reaches its sibling orders only by tracking number.
    expect(addItem).toContain("trackingNumber: input.trackingNumber");
    expect(addItem).toContain("fullPackageOrderId: fpOrder?.id");
    expect(addItem).toContain("packageId: pkg?.id");
  });

  it("the box being scanned into is not held against itself", () => {
    expect(addItem).toContain("exceptBoxId: input.boxId");
  });
});

describe("the paid verdict stays in one home", () => {
  const settle = read("server/db/boxSettlement.db.ts");
  const finder = slice(settle, "export async function findPaidBoxHolding", "\n/**");

  it("reuses getBoxesPaidInFull rather than re-deciding what paid means", () => {
    expect(finder).toContain("getBoxesPaidInFull");
    // No second opinion about payment: the only comparison lives in
    // getBoxesPaidInFull / finishPaidBox.
    expect(finder).not.toContain("SETTLED_SLACK_USD");
    expect(finder).not.toContain("outstandingUsd");
  });

  it("ignores cancelled boxes", () => {
    expect(finder).toContain("'cancelled'");
  });
});
