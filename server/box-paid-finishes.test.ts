import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's rule (2026-09-10): a delivery box paid for in full is finished
 * at once — delivered, closed, archived — and the next box takes its place in
 * the list. Nothing is lost: the archive keeps it, and no step's bookkeeping
 * (the delivery fee above all) is skipped on the way.
 */

const ROOT = __dirname;
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

function between(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `end marker not found after ${start}: ${end}`).toBeGreaterThan(-1);
  return src.slice(a, b);
}

const lib = read("lib/boxLifecycle.ts");
const router = read("routers/scanning.router.ts");

describe("a box paid for in full is finished", () => {
  it("settling finishes the box, after the payment is saved", () => {
    const body = between(router, "settle: staffProcedure", "reverseSettlement:");
    const paid = body.indexOf("await db.createBoxSettlement(input, ctx.user.id)");
    const finished = body.indexOf("await finishPaidBox(input.boxId, ctx.user.id)");
    expect(paid).toBeGreaterThan(-1);
    expect(finished, "the box must be finished only once the money is in").toBeGreaterThan(paid);
  });

  it("decides 'paid in full' from what the settlement screen says is outstanding", () => {
    const fn = between(lib, "export async function finishPaidBox(", "\n}\n");
    expect(fn).toContain("getBoxSettlementView(boxId)");
    expect(fn).toContain("outstandingUsd");
    expect(fn).toContain("SETTLED_SLACK_USD");
  });

  it("goes through the same steps a person would, in order", () => {
    const fn = between(lib, "export async function finishPaidBox(", "\n}\n");
    const steps = ["db.sealBox(", "chargeBoxDeliveryFee(", "markBoxContentsDelivered(", "db.markBoxDelivered("];
    const at = steps.map((s) => fn.indexOf(s));
    for (let i = 0; i < steps.length; i++) expect(at[i], `${steps[i]} is missing`).toBeGreaterThan(-1);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
  });

  it("never lets a failure to finish undo or hide the payment", () => {
    const fn = between(lib, "export async function finishPaidBox(", "\n}\n");
    expect(fn).toContain("} catch (err) {");
    expect(fn).toContain("return { finished: false, error: message }");
  });

  it("leaves a cancelled box alone", () => {
    const fn = between(lib, "export async function finishPaidBox(", "\n}\n");
    expect(fn).toContain('box.status === "cancelled"');
  });
});

describe("each step is written once", () => {
  it("the delivery fee is posted by one function, used by both doors", () => {
    const transit = between(router, "markInTransit: staffProcedure", "markDelivered: staffProcedure");
    expect(transit).toContain("chargeBoxDeliveryFee(box, ctx.user.id)");
    expect(transit, "a second copy of the fee code is how a fee gets posted twice").not.toContain("recordPackageChargeWithoutInvoice(");
    expect(lib).toContain("recordPackageChargeWithoutInvoice(");
  });

  it("marking delivered by hand uses the same contents step", () => {
    const delivered = between(router, "markDelivered: staffProcedure", "cancel: staffProcedure");
    expect(delivered).toContain("markBoxContentsDelivered(box.id, ctx.user.id, input.signature, input.deliveryPhoto)");
    expect(delivered).not.toContain("db.updatePackage(");
  });
});

describe("the list leaves the archive out on the server", () => {
  const dbSrc = read("db/deliveryBoxes.db.ts");
  const fn = between(dbSrc, "export async function getAllDeliveryBoxes(", "\nexport async function");

  it("filters archived boxes in SQL, so a page is a full page", () => {
    expect(fn).toContain('filters?.archive === "exclude"');
    expect(fn).toContain('filters?.archive === "only"');
  });

  it("uses the shared rule's numbers and only confirmed receipts", () => {
    expect(fn).toContain("archiveCutoff()");
    expect(fn).toContain("SETTLED_SLACK_USD");
    expect(fn).toContain("= 'confirmed'");
    // Forgiven money counts beside paid money.
    expect(fn).toContain("discountUsd");
  });

  it("the router lets the screen ask for it", () => {
    expect(between(router, "list: staffProcedure", "settlementView:")).toContain('archive: z.enum(["exclude", "only"]).optional()');
  });
});
