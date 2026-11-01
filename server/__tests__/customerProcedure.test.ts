import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROUTER = fs.readFileSync(path.resolve(__dirname, "routers/portal.router.ts"), "utf8");
const AUTH = fs.readFileSync(path.resolve(__dirname, "middleware/auth.ts"), "utf8");

/**
 * One question, asked once.
 *
 * Every portal endpoint opened by working out which customer was calling, and
 * then each decided for itself what to do when the answer was nobody: fourteen
 * returned an empty list, five null, three zero, three an object with a false
 * in it, and seven threw — some BAD_REQUEST, some NOT_FOUND, some FORBIDDEN.
 *
 * For the customer that was one fault wearing seven faces. The same broken
 * account showed an empty page on one screen, a red error on the next, and on
 * a third threw them out to the login, because the global redirect-on-auth-
 * error subscriber reads FORBIDDEN as "your session has died". Support cannot
 * recognise a fault that never looks the same twice.
 */
describe("the portal works out who is calling in one place", () => {
  it("no endpoint derives the customer for itself", () => {
    const offenders = [...ROUTER.matchAll(/ctx\.user\.isCustomer\s*\?\s*ctx\.user\.id/g)];
    expect(
      offenders.length,
      "use customerProcedure and read ctx.customerId instead of re-deriving it",
    ).toBe(0);
  });

  it("no endpoint is left guarding against a customer that cannot be missing", () => {
    // customerProcedure has already thrown by the time a body runs, so a guard
    // here is dead code that reads as though it still decides something.
    const offenders = [...ROUTER.matchAll(/if\s*\(!customerId\)/g)];
    expect(offenders.length).toBe(0);
  });

  it("answers with one message and one code", () => {
    const start = AUTH.indexOf("export const customerProcedure");
    const proc = AUTH.slice(start, AUTH.indexOf("export const", start + 10));
    expect(proc).toContain("BAD_REQUEST");
    // FORBIDDEN is what the client turns into a forced logout, and the session
    // is not the thing that is wrong — the user is signed in perfectly well.
    expect(proc, "FORBIDDEN bounces a valid session to the login screen")
      .not.toContain("FORBIDDEN");
    expect(proc).toContain("customerId");
  });

  /**
   * The three endpoints that must still answer without a customer profile.
   * getMyAccount is how the portal finds out whether there is one at all, so
   * requiring one to ask would be circular.
   */
  it("keeps the endpoints that have to work without a customer", () => {
    for (const name of [
      "getMyAccount",
      "getUnclaimedPackages",
      "getNewsChannels",
      "getYuanExchangeInfo",
    ]) {
      expect(ROUTER, `${name} must stay protectedProcedure`)
        .toMatch(new RegExp(`${name}: protectedProcedure`));
    }
  });

  it("every other portal endpoint goes through customerProcedure", () => {
    // Anything reading ctx.customerId must have been given it by the middleware;
    // TypeScript enforces that, and this states the intent in one place.
    const customerEndpoints = [...ROUTER.matchAll(/(\w+): customerProcedure/g)].map(m => m[1]);
    expect(customerEndpoints.length).toBeGreaterThan(40);
    for (const name of ["getMyPackages", "getMyInvoices", "sendMessage", "createAddress"]) {
      expect(customerEndpoints, `${name} should be a customerProcedure`).toContain(name);
    }
  });
});
