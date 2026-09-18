import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Linking a declared tracking to its parcel from the Portal Center (owner,
 * 2026-09-18, phase 2) does what approving an ownership claim does, no more:
 * the parcel gets its owner and its price; the charge is not written here.
 * These tests keep the two the same — if approving a claim changes, this
 * says so. When a declaration may be linked is unit-tested in
 * shared/declaredLink.test.ts.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const lib = read("server/lib/linkDeclaredParcel.ts");
const declared = read("server/db/declaredPackages.db.ts");
const portal = read("server/db/portal.db.ts");
const packagesRouter = read("server/routers/packages.router.ts");
const router = read("server/routers/portalCenter.router.ts");
const center = read("server/db/portalCenter.db.ts");
const page = read("client/src/pages/PortalCenter.tsx");

const slice = (source: string, start: string, end: string) => {
  const a = source.indexOf(start);
  expect(a, start).toBeGreaterThan(-1);
  const b = source.indexOf(end, a + start.length);
  expect(b, end).toBeGreaterThan(a);
  return source.slice(a, b);
};
const keysOf = (block: string) =>
  // `key: value` or the shorthand `key,` — one line each.
  Array.from(block.matchAll(/^\s*(\w+)\s*(?::|,)/gm)).map((m) => m[1]).sort();

describe("the owner, as approving a claim gives it", () => {
  it("the same four fields", () => {
    const claim = slice(slice(portal, "export async function approveClaimRequest", "// Reject claim request"), "// Assign package to customer", ".where(");
    const link = slice(declared, "export async function linkUnownedPackageToCustomer", ".where(");
    expect(keysOf(claim.slice(claim.indexOf(".set({")))).toEqual(["claimedAt", "claimedById", "customerId", "isUnclaimed"]);
    expect(keysOf(link.slice(link.indexOf(".set({")))).toEqual(["claimedAt", "claimedById", "customerId", "isUnclaimed"]);
    expect(link).toContain("isUnclaimed: false,");
  });

  it("only while the parcel is still nobody's, in the same statement", () => {
    expect(declared).toContain(".where(and(eq(packages.id, packageId), isNull(packages.customerId)));");
  });
});

describe("the price, as approving a claim sets it", () => {
  it("from the same resolver, with the same inputs", () => {
    const claim = slice(slice(packagesRouter, "approveClaimRequest: adminProcedure", "rejectClaimRequest:"), "resolveParcelCost({", "});");
    const link = slice(lib, "resolveParcelCost({", "});");
    expect(keysOf(link)).toEqual(keysOf(claim));
    expect(keysOf(link)).toEqual(
      ["batchId", "customerId", "heightCm", "lengthCm", "originWarehouseId", "shippingType", "volumeCbm", "weightKg", "widthCm"],
    );
    expect(lib).toContain("if (!pkg || pkg.isCharged) return;");
  });

  it("and no charge is written here", () => {
    expect(lib).not.toMatch(/ensureParcelCharged|recordCharge|createLedger|chargeParcel/);
  });
});

describe("asked again at the moment of linking", () => {
  it("the route runs the shared rule, and records who linked what", () => {
    expect(lib).toContain("const refusal = declaredLinkRefusal(declared, parcel ?? null);");
    expect(router).toContain("const result = await linkDeclaredParcel(input.declarationId, ctx.user.id);");
    expect(router).toContain('action: "link_declared_package",');
  });

  it("the list offers the button only where the same rule allows it", () => {
    expect(center).toContain("const linkable = !!parcel && declaredLinkRefusal(r, parcel) === null;");
  });

  it("the page asks before linking", () => {
    expect(page).toContain("{d.linkablePackageId && (");
    const ask = slice(page, "const askToLink = async", "\n  };\n");
    expect(ask).toContain("await confirmAction({");
    expect(ask.indexOf("await confirmAction")).toBeLessThan(ask.indexOf("link.mutate({ declarationId: d.id })"));
  });
});
