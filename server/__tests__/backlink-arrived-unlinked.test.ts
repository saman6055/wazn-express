import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * Owner, 2026-10-22: a parcel registered as a self order, its freight already
 * on the account, then claimed by a buy-at-cost order - the link is refused
 * (finance_closed, so no money moves) but the order still reads «گەیشتە
 * کۆگای چین» instead of staying «داواکراو». Proven on real MySQL: the account
 * stays $20 freight + $55 goods, once each.
 */
describe("an order whose parcel arrived but could not be linked", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "db/packages.db.ts"), "utf8").replace(/\r\n/g, "\n");
  const fn = src.slice(src.indexOf("export async function backlinkRegisteredPackagesForOrder"), src.indexOf("export async function getVolumetricThresholds"));

  it("moves its status like a linked one, and only for the customer's own parcel", () => {
    expect(fn.length).toBeGreaterThan(100);
    expect(fn).toContain("const arrivedUnlinked = conflicts.some((c) => c.reason === 'finance_closed');");
    expect(fn).toContain("if (linked.length > 0 || arrivedUnlinked) {");
    expect(fn).toContain("await promoteOrderStatusIfFullyReceived(orderId);");
  });

  it("the money rule is untouched: a charged parcel is still never linked", () => {
    const rule = fs.readFileSync(path.resolve(__dirname, "lib/orderBacklink.ts"), "utf8");
    expect(rule).toContain("if (pkg.isCharged || TERMINAL_PACKAGE_STATUS.has(pkg.status)) {");
  });
});
