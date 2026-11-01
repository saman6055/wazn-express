/**
 * Owner, 2026-10-22: a parcel entered on the wrong customer and put right must
 * leave nothing on the old one - nobody is charged for goods that went to
 * somebody else. The owner and the money move together, or neither moves.
 *
 * Proved on real MySQL before shipping (the old code let Helin's order into
 * Zainab's box and let a claim take an owned parcel). These guards keep every
 * door shut: each marker must be found, or the test fails rather than
 * checking nothing.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const slice = (src: string, start: string, end: string) => {
  const a = src.indexOf(start);
  expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `end marker not found: ${end}`).toBeGreaterThan(-1);
  return src.slice(a, b);
};

describe("a parcel's owner never moves without its money", () => {
  const router = read("server/routers/packages.router.ts");

  it("the parcel edit asks first, and refuses when the money cannot follow", () => {
    const update = slice(router, "    update: staffProcedure", "    delete: adminProcedure");
    expect(update).toContain("const why = await db.ownerMoveRefusal(current, data.customerId ?? null);");
    expect(update).toContain('if (ownerMoves && onAccount?.outcome === "held")');
    // The refusal comes before the row is written.
    expect(update.indexOf("db.ownerMoveRefusal(current,")).toBeLessThan(update.indexOf("await db.updatePackage(id, updateData);"));
  });

  it("registration refuses a customer who is not the linked order's", () => {
    expect(router).toContain("input.customerId !== ordersOwner");
  });

  it("a claim never takes a parcel that already has an owner", () => {
    const approve = slice(router, "    approveClaimRequest: adminProcedure", "const result = await db.approveClaimRequest(");
    expect(approve).toContain("claimed.customerId !== request.customerId");
    const claim = slice(read("server/db/packages.db.ts"), "export async function claimPackage(", "export async function getUnclaimedPackageCount");
    expect(claim).toContain("or(eq(packages.isUnclaimed, true), isNull(packages.customerId))");
  });

  it("the one refusal covers an order behind the parcel, a box and a receipt", () => {
    const fn = slice(read("server/db/parcelCorrection.db.ts"), "export async function ownerMoveRefusal(", "\n}\n");
    expect(fn).toContain("(await ordersBehindParcel(pkg)).filter((o) => o.customerId !== toCustomerId)");
    expect(fn).toContain("return parcelCorrectionRefusal(pkg.id, name);");
  });
});

describe("goods of another customer's order never enter a box", () => {
  const boxes = read("server/db/deliveryBoxes.db.ts");

  it("every way into a box asks", () => {
    expect(slice(boxes, "export async function addItemToBox(", "await db.insert(deliveryBoxItems)")).toContain("foreignOrderInBox(owner.customerId, data)");
    // The two batch fillers leave such a parcel out.
    expect(boxes.match(/if \(await foreignOrderInBox\(/g)?.length).toBe(2);
    expect(read("server/routers/scanning.router.ts")).toContain("await db.foreignOrderInBox(box.customerId, { packageId: pkg?.id, fullPackageOrderId: fpOrder?.id })");
  });

  it("a cancelled or deleted order does not count", () => {
    const fn = slice(boxes, "export async function foreignOrderInBox(", "\n}\n");
    expect(fn).toContain("isNull(fullPackageOrders.deletedAt)");
    expect(fn).toContain("NOT IN ('cancelled','refunded','rejected')");
  });
});

describe("the auditor finds money standing on the wrong person", () => {
  it("two critical checks, each with its query", async () => {
    const { CHECKS } = await import("@shared/auditSweep");
    for (const id of ["parcel_charged_to_other", "order_charged_to_other"]) {
      expect(CHECKS.find((c) => c.id === id)?.severity).toBe("critical");
      expect(read("server/services/auditSweep.service.ts")).toContain(`  ${id}: \``);
    }
  });
});
