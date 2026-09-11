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
