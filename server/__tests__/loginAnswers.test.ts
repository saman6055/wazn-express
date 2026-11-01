import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A sign-in must not tell a stranger which phone numbers are accounts.
 * The login procedures need a database to run, so these read the source:
 * which answer each kind of miss gets, and in what order the checks happen.
 */
const SRC = fs.readFileSync(path.resolve(__dirname, "routers/auth.router.ts"), "utf8");

function body(name: string): string {
  const start = SRC.indexOf(`${name}: publicProcedure`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const next = SRC.indexOf(": publicProcedure", start + name.length + 20);
  return SRC.slice(start, next > -1 ? next : undefined);
}

describe("customer sign-in", () => {
  const src = body("customerLogin");

  it("an unknown number and an account without a password get the wrong-password answer, after the same wait", () => {
    expect(src).toMatch(/if \(!customer \|\| !customer\.passwordHash\) \{\s*await spendComparisonTime\(input\.password\);\s*throw new TRPCError\(\{ code: "UNAUTHORIZED", message: CUSTOMER_LOGIN_MISS \}\)/);
    expect(src).not.toContain("وشەی نهێنی دانەنراوە");
  });

  it("a wrong password gets the very same sentence, or the unchanged lockout message", () => {
    expect(src).toContain("after.justLocked ? LOCKED_MESSAGE.ku : CUSTOMER_LOGIN_MISS");
  });

  it("the lock is still checked before the password, as designed", () => {
    expect(src.indexOf("lockState(")).toBeLessThan(src.indexOf("bcrypt.compare("));
  });

  it("only someone who knows the password learns the account is switched off", () => {
    expect(src.indexOf("bcrypt.compare(")).toBeLessThan(src.indexOf("!customer.isActive"));
  });
});

describe("staff sign-in", () => {
  const src = body("staffLogin");

  it("unknown, no password and wrong password are one answer", () => {
    expect(src).toMatch(/if \(!user \|\| !user\.passwordHash\) \{\s*await spendComparisonTime\(input\.password\);/);
    // Both misses give the same sentence — or, on the fifth, the same lock
    // message: unknown names are counted too (server/lib/staffLoginLocks.ts).
    expect(src.match(/message: after\.justLocked \? STAFF_LOCKED_MESSAGE : STAFF_LOGIN_MISS/g)?.length).toBe(2);
    expect(src.indexOf("staffLockState(")).toBeLessThan(src.indexOf("bcrypt.compare("));
    expect(src).not.toContain("وشەی نهێنی دانەنراوە");
  });

  it("only someone who knows the password learns the account is switched off", () => {
    expect(src.indexOf("bcrypt.compare(")).toBeLessThan(src.indexOf("!user.isActive"));
  });
});

describe("the wait", () => {
  it("is a real bcrypt comparison at the cost real hashes use", () => {
    expect(SRC).toContain('bcrypt.hash("wazn-timing-equaliser", 12)');
    expect(SRC).toMatch(/async function spendComparisonTime[\s\S]{0,200}bcrypt\.compare\(password/);
  });
});

/**
 * The office side of the same lock.
 *
 * The rules above keep the login from telling a stranger anything. Their cost
 * is that the office is told nothing either, and that is what broke: a
 * customer mistyped five times, the account shut for fifteen minutes, and on
 * every screen it still looked active with a password set. The one remedy
 * anyone reached for — another reset — left the lock standing, so the new
 * password was refused too and the reset looked like it had done nothing.
 */
describe("a shut-out customer can be seen and let back in", () => {
  const CENTER = fs.readFileSync(path.resolve(__dirname, "routers/portalCenter.router.ts"), "utf8");
  const CUSTOMERS_DB = fs.readFileSync(path.resolve(__dirname, "db/customers.db.ts"), "utf8");

  function slice(src: string, from: string, to: string): string {
    const a = src.indexOf(from);
    expect(a, from).toBeGreaterThan(-1);
    const b = src.indexOf(to, a + from.length);
    expect(b, to).toBeGreaterThan(-1);
    return src.slice(a, b);
  }

  it("the diagnosis reports the lock, and before it judges the password", () => {
    const diag = slice(CENTER, "diagnoseCustomerLogin: adminProcedure", "resetCustomerPassword: adminProcedure");
    // The step exists at all: without it this tool called a locked account's
    // password "working" while the portal was turning the customer away.
    expect(diag).toContain('step: "locked" as const');
    // In the same order the login uses: while the account is shut, what the
    // customer typed is never compared.
    expect(diag.indexOf('step: "locked"')).toBeLessThan(diag.indexOf("bcrypt.compare("));
    // And carried on every other answer too, so "the password is right" can
    // never be the whole story.
    expect(diag).toContain("lockedForMinutes: lock.locked ? lock.remainingMinutes : null");
  });

  it("the office panel is told how long the account is shut for", () => {
    const sec = slice(CENTER, "getCustomerSecurity: adminProcedure", "unlockCustomerLogin: adminProcedure");
    expect(sec).toContain("lockedForMinutes");
    /*
     * A derived number, not the row. accountSecrets keeps lockedUntil and the
     * attempt tally out of every account row that reaches a browser, and one
     * admin answer saying "shut for nine more minutes" does not undo that.
     *
     * So the timestamp may be read here, and only read: every mention of it
     * is the argument handed to lockState. The attempt tally is not wanted at
     * all — the minutes are the part anybody can act on.
     */
    const reads = sec.match(/c\.lockedUntil/g)?.length ?? 0;
    const intoLockState = sec.match(/lockState\(\{ lockedUntil: c\.lockedUntil/g)?.length ?? 0;
    expect(reads).toBe(intoLockState);
    expect(intoLockState).toBeGreaterThan(0);
    expect(sec).not.toContain("c.failedLoginAttempts");
  });

  it("there is a way to lift it that does not change the password", () => {
    expect(CENTER).toContain("unlockCustomerLogin: adminProcedure");
    const unlock = slice(CENTER, "unlockCustomerLogin: adminProcedure", "diagnoseCustomerLogin: adminProcedure");
    expect(unlock).toContain("db.clearFailedCustomerLogins(input.customerId)");
    // Someone else's account was opened; both trails say who.
    expect(unlock).toContain('action: "unlock_customer_login"');
    expect(unlock).toContain('action: "admin_unlocked_login"');
  });

  it("a new password ends the run of failures, wherever it is set from", () => {
    // In the one writer rather than at a caller, so a staff reset and a
    // customer choosing their own both release the lock.
    const set = slice(CUSTOMERS_DB, "export async function updateCustomerPassword", "export async function ");
    expect(set).toContain("failedLoginAttempts: 0");
    expect(set).toContain("lastFailedLoginAt: null");
    expect(set).toContain("lockedUntil: null");
  });
});
