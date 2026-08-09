import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { normalizePhone, phoneVariants, samePhone } from "../shared/phone";

/**
 * The failure this exists to stop.
 *
 * A customer's number is stored as `07740427884`. They type `7740427884`.
 * The lookup compared with `=`, matched nothing, and the portal answered
 * "wrong phone number or password" — which named the password. Staff reset
 * the password, the customer still could not sign in, and the password had
 * never been the problem.
 */
describe("a phone number is the same number however it is written", () => {
  it("reduces every shape to the digits that identify it", () => {
    for (const written of [
      "07740427884",
      "7740427884",
      "+9647740427884",
      "009647740427884",
      "964 774 042 7884",
      "0774-042-7884",
      "+964 774 042 7884",
    ]) {
      expect(normalizePhone(written), written).toBe("7740427884");
    }
  });

  it("says two differently-written numbers are the same", () => {
    expect(samePhone("07740427884", "7740427884")).toBe(true);
    expect(samePhone("+964 774 042 7884", "07740427884")).toBe(true);
    expect(samePhone("07740427884", "07740427885")).toBe(false);
  });

  it("never matches on nothing", () => {
    // Two empty numbers are not the same customer.
    expect(samePhone("", "")).toBe(false);
    expect(samePhone(null, undefined)).toBe(false);
    expect(normalizePhone(null)).toBe("");
    expect(phoneVariants("")).toEqual([]);
  });

  it("offers every shape a row might already be stored as", () => {
    const v = phoneVariants("0750 123 4567");
    for (const shape of ["7501234567", "07501234567", "9647501234567", "+9647501234567"]) {
      expect(v, shape).toContain(shape);
    }
    // And what was actually typed, for anything this does not predict.
    expect(v).toContain("0750 123 4567");
  });
});

describe("the login looks a customer up by the number, not the spelling", () => {
  const DB = fs.readFileSync(path.resolve(__dirname, "db/customers.db.ts"), "utf8");
  const fn = DB.slice(
    DB.indexOf("export async function getCustomerByMobile"),
    DB.indexOf("export async function getCustomerByCode"),
  );

  it("matches every stored shape", () => {
    expect(fn).toContain("phoneVariants(mobileNumber)");
    expect(fn).toContain("inArray(customers.mobileNumber, variants)");
    expect(fn, "an equality here is the bug").not.toMatch(/eq\(customers\.mobileNumber, mobileNumber\)/);
  });

  /**
   * mobileNumber is not unique in the schema. Without preferring the exact
   * match, a customer who typed their number precisely as stored could be
   * handed a different account that merely normalises to the same digits.
   */
  it("prefers the row that matches exactly", () => {
    expect(fn).toContain("rows.find(r => r.mobileNumber === mobileNumber)");
  });

  /**
   * Fixing the lookup is the real repair; the hint only saves the customer
   * wondering which shape to use.
   */
  it("the login screen says both shapes work", () => {
    const page = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/CustomerLogin.tsx"), "utf8");
    expect(page).toMatch(/0750….*750…/s);
  });
});

describe("both reset screens set the same password", () => {
  const SHARED = fs.readFileSync(path.resolve(__dirname, "../shared/resetPassword.ts"), "utf8");
  const CENTRE = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/PortalCenter.tsx"), "utf8");
  const LIST = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/Customers.tsx"), "utf8");

  /**
   * There are two places staff can reset a customer's password. The one thing
   * worse than a weak default is two different weak defaults, with staff
   * reading out whichever one they last saw — which is exactly the confusion
   * that made this look like a broken password feature in the first place.
   */
  it("the default lives in one place", () => {
    expect(SHARED).toContain('export const DEFAULT_RESET_PASSWORD = "123456"');
    for (const [name, src] of [["portal centre", CENTRE], ["customers list", LIST]] as const) {
      expect(src, `${name} must import it`).toContain("DEFAULT_RESET_PASSWORD");
      expect(src, `${name} must not restate it`).not.toMatch(/DEFAULT_RESET_PASSWORD\s*=\s*"/);
    }
  });

  it("both screens start with it filled in", () => {
    expect(CENTRE).toContain("useState(DEFAULT_RESET_PASSWORD)");
    expect(LIST).toContain("defaultValue={DEFAULT_RESET_PASSWORD}");
  });

  /**
   * Six digits is the shortest the server accepts. If that rule ever
   * tightens, this default stops working and staff find out by a reset
   * failing — so the two are pinned together here.
   */
  it("the default satisfies the server's own minimum", () => {
    const portalCentre = fs.readFileSync(
      path.resolve(__dirname, "routers/portalCenter.router.ts"), "utf8");
    const customers = fs.readFileSync(
      path.resolve(__dirname, "routers/customers.router.ts"), "utf8");
    expect(portalCentre).toMatch(/newPassword: z\.string\(\)\.min\(6\)/);
    expect(customers).toMatch(/newPassword: z\.string\(\)\.min\(6\)/);
    expect("123456".length).toBeGreaterThanOrEqual(6);
  });

  /**
   * A password that cannot be read back is a second phone call. Staff have to
   * be able to see what they are about to read out.
   */
  it("the customers list shows the password rather than masking it", () => {
    const at = LIST.indexOf('name="newPassword"');
    expect(LIST.slice(at - 200, at + 200)).not.toContain('type="password"');
  });
});
