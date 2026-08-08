import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The screens where a customer types something and presses a button.
 *
 * These are the screens a customer only visits when they already want
 * something from us — a delivery address, a tracking number they are trying
 * to claim. A form that fails here does not lose a page view; it loses the
 * thing they came to do.
 */

const PORTAL = path.resolve(__dirname, "pages/portal");
const read = (p: string) => fs.readFileSync(path.join(PORTAL, p), "utf8");
const ROUTER = fs.readFileSync(
  path.resolve(__dirname, "../../server/routers/portal.router.ts"), "utf8");
const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, "../../drizzle/schema/users.schema.ts"), "utf8");

describe("what a customer types fits where it is going", () => {
  /**
   * Neither the form nor the router knew the column widths, so a long street
   * name was accepted by both, sent, and then left to MySQL — an error the
   * customer could not read, or a silent truncation that cut their delivery
   * address off mid-word. The addresses are how goods physically reach
   * someone; a truncated one is a parcel at the wrong door.
   */
  const ADDRESS_LIMITS: Record<string, number> = {
    label: 100, recipientName: 255, phone: 20, city: 100, district: 100,
    street: 255, building: 100, floor: 20, apartment: 20,
  };

  it("the address columns still have the widths these limits were taken from", () => {
    // If someone widens a column, this test should be what tells them the
    // form and the router now disagree with it.
    for (const [field, max] of Object.entries(ADDRESS_LIMITS)) {
      expect(SCHEMA, `${field} column width changed`)
        .toContain(`${field}: varchar("${field}", { length: ${max} })`);
    }
  });

  it("the address form stops at the column width", () => {
    const src = read("PortalAddresses.tsx");
    for (const [field, max] of Object.entries(ADDRESS_LIMITS)) {
      const at = src.indexOf(`value={formData.${field}}`);
      expect(at, `${field} field not found`).toBeGreaterThan(-1);
      const tag = src.slice(Math.max(0, at - 300), at);
      expect(tag, `${field} needs maxLength={${max}}`).toContain(`maxLength={${max}}`);
    }
  });

  it("the router refuses what the column cannot hold", () => {
    const block = ROUTER.slice(
      ROUTER.indexOf("createAddress: protectedProcedure"),
      ROUTER.indexOf("deleteAddress"),
    );
    for (const [field, max] of Object.entries(ADDRESS_LIMITS)) {
      expect(block, `${field} must be capped server-side too`)
        .toMatch(new RegExp(`${field}: z\\.string\\(\\)[^,]*\\.max\\(${max}\\)`));
    }
    // A tracking number is varchar(100) as well.
    expect(ROUTER).toMatch(/trackingNumber: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(100\)/);
  });

  /**
   * A phone number typed on a QWERTY keyboard is three extra taps and a wrong
   * digit, and this one is the number a driver rings from outside the door.
   */
  it("numeric fields open a numeric keyboard", () => {
    const src = read("PortalAddresses.tsx");
    const phoneAt = src.indexOf("value={formData.phone}");
    expect(src.slice(Math.max(0, phoneAt - 400), phoneAt)).toMatch(/inputMode="tel"/);
    for (const field of ["building", "floor", "apartment"]) {
      const at = src.indexOf(`value={formData.${field}}`);
      expect(src.slice(Math.max(0, at - 300), at), `${field} should be numeric`)
        .toContain('inputMode="numeric"');
    }
  });

  /**
   * Cancelling a declaration was one tap on a 36-pixel icon sitting beside
   * the row the customer was reading.
   */
  it("cancelling a declaration takes two taps", () => {
    const src = read("PortalDeclarePackage.tsx");
    expect(src).toContain("confirmCancelId");
    // The destructive call must not hang directly off the icon button.
    expect(src).not.toMatch(/onClick=\{\(\) => cancelMutation\.mutate\(/);
  });
});
