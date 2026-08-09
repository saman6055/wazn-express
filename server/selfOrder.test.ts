import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { isSelfOrder } from "./lib/selfOrder";

/**
 * A self order is a parcel we ship but never bought. Two very different parts
 * of the system read that state: the revenue report, which decides what the
 * office earned, and the customer portal, which decides which tab a customer
 * finds their goods under. If those two ever disagreed about the same box,
 * one of them would be lying about money.
 *
 * So there is one rule, and these tests hold it in place.
 */

const OWNED = { fullPackageOrderId: null, customerId: 7, isUnclaimed: false };

describe("what counts as a self order", () => {
  it("is a parcel with an owner and no order behind it", () => {
    expect(isSelfOrder(OWNED)).toBe(true);
  });

  it("stops the moment an order claims it", () => {
    // This is the whole design. Staff quick-register a box that nobody entered
    // yet; days later the admin enters the purchase order with the same
    // tracking, orderBacklink writes fullPackageOrderId, and the parcel leaves
    // the self-order list on its own — no migration, no second copy of state,
    // and the money reports move with it.
    expect(isSelfOrder({ ...OWNED, fullPackageOrderId: 42 })).toBe(false);
  });

  it("is never an ownerless box", () => {
    // An unclaimed parcel is nobody's purchase yet. Counting it as a self
    // order would attribute revenue to a customer who has not been identified.
    expect(isSelfOrder({ ...OWNED, customerId: null })).toBe(false);
    expect(isSelfOrder({ ...OWNED, isUnclaimed: true })).toBe(false);
  });
});

describe("only one copy of the rule exists", () => {
  // The rule is three clauses long, which makes it exactly the kind of thing
  // somebody re-types inline in a new query rather than importing. That is how
  // the report and the portal would drift apart, and it would show up as a
  // customer seeing a parcel in the wrong tab long before anyone noticed the
  // revenue was double-counted.
  const ROOT = path.resolve(__dirname);

  function serverFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...serverFiles(p));
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(p);
    }
    return out;
  }

  it("nobody re-writes the clauses inline", () => {
    const offenders = serverFiles(ROOT)
      .filter((f) => path.basename(f) !== "selfOrder.filter.ts")
      .filter((f) => fs.readFileSync(f, "utf8").includes("isNull(packages.fullPackageOrderId)"))
      .map((f) => path.relative(ROOT, f));

    expect(
      offenders,
      `import selfOrderConditions/selfOrderWhere from db/selfOrder.filter instead:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("both readers come through the shared filter", () => {
    // Named explicitly: these are the two that must agree, and a rename or a
    // rewrite that quietly drops one should fail here rather than in
    // production.
    const report = fs.readFileSync(path.join(ROOT, "db/reports.db.ts"), "utf8");
    const portal = fs.readFileSync(path.join(ROOT, "db/portal.db.ts"), "utf8");

    expect(report).toContain("selfOrderConditions");
    expect(portal).toContain("selfOrderWhere");
  });
});

describe("a parcel finds its order however the order records the tracking", () => {
  const pkgDb = fs.readFileSync(path.resolve(__dirname, "db/packages.db.ts"), "utf8");
  const fpDb = fs.readFileSync(path.resolve(__dirname, "db/fullPackage.db.ts"), "utf8");

  /**
   * The bug this exists to stop coming back.
   *
   * An order can carry several tracking numbers, and those live in
   * fullPackageOrderTrackings rather than on the order's own column.
   * createPackage only looked at the order's own column, so a parcel
   * registered against a multi-tracking order never found its order,
   * fullPackageOrderId stayed null, and the parcel therefore satisfied
   * isSelfOrder.
   *
   * What the customer saw: the same tracking number in the admin's
   * full-package screen with a buy price, a sell price and a profit against
   * it, and in their own portal under "goods I bought myself". They had
   * bought nothing.
   */
  it("createPackage looks in both places", () => {
    const fn = pkgDb.slice(pkgDb.indexOf("export async function createPackage"));
    const head = fn.slice(0, 3000);
    expect(head, "the order's own column").toContain("eq(fullPackageOrders.trackingNumber, data.trackingNumber)");
    expect(head, "and the multi-tracking table").toContain("eq(fullPackageOrderTrackings.trackingNumber, data.trackingNumber)");
  });

  /**
   * And the reverse. Removing a tracking from an order deleted the tracking
   * row and left packages.fullPackageOrderId pointing at the order, so the
   * parcel kept the order's money hanging off it and did not go back to being
   * the customer's own purchase.
   */
  it("removing a tracking releases the parcel", () => {
    const fn = fpDb.slice(fpDb.indexOf("export async function removeOrderTracking"));
    const body = fn.slice(0, 2500);
    expect(body).toContain("set({ fullPackageOrderId: null })");
    // Only when nothing else on the order still claims that tracking.
    expect(body, "the order's own column may still claim it").toContain("stillOnOrderColumn");
    expect(body, "and another row may still claim it").toMatch(/others\.length === 0/);
  });

  /**
   * Releasing has to mean setting the column to null, not writing a flag.
   * The whole design is that self-order state is derived from this one
   * column, so a second copy of the truth must never appear.
   */
  it("nothing stores self-order state", () => {
    for (const src of [pkgDb, fpDb]) {
      expect(src).not.toMatch(/isSelfOrder\s*[:=]\s*(true|false)/);
    }
  });
});
