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
