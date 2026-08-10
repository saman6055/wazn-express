import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Switching an account off has to take effect now, not in a week.
 *
 * Both logins refused an inactive account, and nothing after the login ever
 * asked again. The session cookie lasts seven days, so deactivating a customer
 * — or a member of staff on the day they left — left them with up to a week of
 * full access: parcels, money, documents, and for staff the admin screens.
 * Nobody in the office had any way to end it.
 *
 * The check belongs on the request, not the token: the session was minted
 * before the decision to switch them off, so it cannot be asked about it.
 */
describe("a deactivated account cannot keep using an open session", () => {
  const SDK = fs.readFileSync(path.resolve(__dirname, "_core/sdk.ts"), "utf8");
  const auth = SDK.slice(
    SDK.indexOf("async authenticateRequest"),
    SDK.indexOf("Regular OAuth user flow"),
  );

  it("the customer branch re-checks isActive on every request", () => {
    const branch = auth.slice(
      auth.indexOf("session.customerId && session.isCustomer"),
      auth.indexOf("Handle staff login sessions"),
    );
    expect(branch, "the row is read; it must also be judged").toContain("customer.isActive");
    expect(branch).toMatch(/if\s*\(!customer\.isActive\)/);
  });

  it("the staff branch re-checks isActive on every request", () => {
    const branch = auth.slice(auth.indexOf("Handle staff login sessions"));
    expect(branch).toMatch(/if\s*\(!user\.isActive\)/);
  });

  /**
   * The check has to read the freshly-loaded row. Trusting a claim inside the
   * cookie would be the same bug wearing a different hat — the cookie was
   * issued while the account was still active.
   */
  it("judges the database row, not the session payload", () => {
    expect(auth).not.toMatch(/session\.isActive/);
  });

  it("the login still refuses an inactive account at the door", () => {
    const login = fs.readFileSync(path.resolve(__dirname, "routers/auth.router.ts"), "utf8");
    expect(login).toMatch(/if\s*\(!customer\.isActive\)/);
    expect(login).toMatch(/if\s*\(!user\.isActive\)/);
  });
});
