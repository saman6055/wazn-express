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
