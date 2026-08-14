import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Every place that decides what a customer pays for a shipment asks the same
 * question, in the same order.
 *
 * It did not. The order — the rate agreed with this customer, then their
 * tier, then the shipment's own rate — was written out by hand in four
 * places, and the two that mattered most had left the agreed rate out. A
 * customer with a negotiated price saw it in the portal, saw it counted in
 * the profit report, and was invoiced the shipment default.
 *
 * These read source text on purpose. The charging paths need a live database
 * to run, so the only cheap way to keep them honest is to check that they
 * still ask.
 */

const ROOT = path.resolve(__dirname, "../..");

/**
 * Line endings are normalised because the markers below span lines. A working
 * copy checked out with CRLF would make every "\n}" miss, and a slice that
 * finds nothing quietly asserts nothing.
 */
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

describe("the rate a customer is billed at", () => {
  it("is decided in one place", () => {
    const rule = read("shared/batchRate.ts");
    expect(rule).toContain("export function resolveBatchRate");
    // The order itself, in the order it must stay.
    expect(rule.indexOf('source: "customer"')).toBeLessThan(rule.indexOf('source: "tier"'));
    expect(rule.indexOf('source: "tier"')).toBeLessThan(rule.indexOf('source: "batch"'));
  });

  it("is fetched through one server function", () => {
    const src = read("server/db/batches.db.ts");
    const fn = slice(src, "export async function getBatchRateForCustomer", "\n}\n");
    expect(fn).toContain("getCustomerPricingInBatch");
    expect(fn).toContain("resolveBatchRate");
    expect(fn).toContain("getApplicableTierPrice");
  });
});

describe("the paths that charge money ask it", () => {
  it("the batch invoice run resolves a rate per customer", () => {
    const src = read("server/routers/batches.router.ts");
    const run = slice(src, "// ===== PHASE 1: COLLECT =====", "// ===== PHASE 3");

    // Every charge in the run goes through the per-customer rate, never the
    // batch-level constants read once at the top.
    expect(run).toContain("ratesFor(");
    expect(run).not.toMatch(/pkgPrice\s*=\s*\w+\s*\*\s*pricePer(Kg|Cbm)\b/);
    expect(run).not.toMatch(/shippingCost\s*=\s*\w+\s*\*\s*pricePer(Kg|Cbm)\b/);
  });

  it("the per-package delivery charge asks it", () => {
    const src = read("server/routers/packages.router.ts");
    expect(src).toContain("getBatchRateForCustomer");
  });

  it("a package claimed after delivery is charged the same way", () => {
    // This path exists to mirror the batch run for a parcel whose owner
    // appeared late. Mirroring it means the same rate, not just the same math.
    const src = read("server/routers/packages.router.ts");
    const late = slice(src, "let lateCharge:", "// Skip the late-charge");
    expect(late).toContain("getBatchRateForCustomer");
  });

  it("the staff quote asks it", () => {
    const src = read("server/routers/batches.router.ts");
    const quote = slice(src, "calculateCustomerPrice: staffProcedure", "\n      }),");
    expect(quote).toContain("getBatchRateForCustomer");
  });
});

describe("nobody re-implements the order", () => {
  const FILES = [
    "server/routers/batches.router.ts",
    "server/routers/packages.router.ts",
    "server/db/portal.db.ts",
    "server/db/batches.db.ts",
  ];

  it("no file walks tier-then-default on its own", () => {
    // The shape that skipped the agreed rate: consult the tier, and if it
    // returns nothing fall straight to the shipment's own price.
    const offenders = FILES.filter((rel) => {
      const src = read(rel);
      if (rel.endsWith("batches.db.ts")) {
        // getApplicableTierPrice itself lives here; the resolver is allowed
        // to call it. What is not allowed is a second copy of the order.
        const outside = src.replace(
          slice(src, "export async function getBatchRateForCustomer", "\n}\n"),
          "",
        );
        return /getApplicableTierPrice\([\s\S]{0,400}?pricePer(Kg|Cbm)/.test(outside)
          && !/resolveBatchRate/.test(outside);
      }
      return /getApplicableTierPrice\([\s\S]{0,400}?pricePer(Kg|Cbm)/.test(src);
    });

    expect(
      offenders,
      `use db.getBatchRateForCustomer — the agreed rate comes first:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the portal preview and the invoice agree by construction", () => {
    // The portal quoted the customer their agreed rate while the invoice run
    // did not. Both now read the same function, so they cannot drift again.
    const portal = read("server/db/portal.db.ts");
    expect(portal).toContain("getBatchRateForCustomer");
  });
});
