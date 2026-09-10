import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { sessionAccount, withoutSecrets } from "./lib/accountSecrets";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

const CUSTOMER = {
  id: 7,
  fullName: "Customer",
  mobileNumber: "07501234567",
  customerCode: "EB16",
  passwordHash: "$2a$12$abcdefghijklmnopqrstuv",
  failedLoginAttempts: 3,
  lastFailedLoginAt: new Date("2026-09-01T10:00:00Z"),
  lockedUntil: null,
  passportUrl: "/uploads/passport.jpg",
  nationalIdUrl: "/uploads/id.jpg",
  contractUrl: null,
  notes: "for the office only",
};

const SECRETS = ["passwordHash", "failedLoginAttempts", "lastFailedLoginAt", "lockedUntil"];

describe("account secrets stay on the server", () => {
  it("a staff screen gets the customer's file but never the hash or the lockout counters", () => {
    const row = withoutSecrets(CUSTOMER);
    for (const key of SECRETS) expect(row, key).not.toHaveProperty(key);
    // The documents tab still needs these.
    expect(row.passportUrl).toBe("/uploads/passport.jpg");
    expect(row.notes).toBe("for the office only");
    expect(row.customerCode).toBe("EB16");
  });

  it("does not touch the row it was given", () => {
    withoutSecrets(CUSTOMER);
    expect(CUSTOMER.passwordHash).toBeTruthy();
  });

  it("the signed-in customer's own session carries no secrets and no office file", () => {
    const me = sessionAccount({ ...CUSTOMER, role: "customer", isCustomer: true });
    for (const key of [...SECRETS, "passportUrl", "nationalIdUrl", "contractUrl", "notes"]) {
      expect(me, key).not.toHaveProperty(key);
    }
    expect(me).toMatchObject({ id: 7, fullName: "Customer", role: "customer", isCustomer: true });
  });

  it("a staff member's session keeps their role and loses their hash", () => {
    const me = sessionAccount({ id: 1, name: "Staff", role: "admin", isCustomer: false, passwordHash: "x" });
    expect(me).toEqual({ id: 1, name: "Staff", role: "admin", isCustomer: false });
  });

  it("no one signed in is null", () => {
    expect(sessionAccount(null)).toBeNull();
    expect(sessionAccount(undefined)).toBeNull();
  });
});

describe("the wiring", () => {
  it("auth.me answers with the session account, not ctx.user", () => {
    const src = read("routers/auth.router.ts");
    expect(src).toContain("me: publicProcedure.query(opts => sessionAccount(opts.ctx.user))");
  });

  it("the staff customer list and customer detail drop the secrets", () => {
    const src = read("routers/customers.router.ts");
    expect(src).toContain("(await db.getAllCustomers()).map((c) => withoutSecrets(c))");
    expect(src).toContain("return withoutSecrets(customer);");
  });

  it("the staff list drops the secrets", () => {
    expect(read("routers/admin.router.ts")).toContain("(await db.getAllUsers()).map((u) => withoutSecrets(u))");
  });

  it("the browser no longer keeps a copy of the account row", () => {
    const src = read("../client/src/_core/hooks/useAuth.ts");
    expect(src).not.toContain("JSON.stringify(meQuery.data)");
  });
});
