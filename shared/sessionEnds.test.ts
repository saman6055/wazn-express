import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { sessionEnded } from "./sessionEnds";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

/**
 * A password change ends every session opened before it.
 *
 * Until this rule, a stolen phone kept its customer session for a year
 * after the password was changed, and a staff member's for the rest of the
 * day. The pieces: every token carries its minting time, a password change
 * stamps the account, and the request check compares the two.
 */
describe("sessionEnded", () => {
  const T = Date.parse("2026-10-22T10:00:00Z");

  it("ends a token minted before the stamp", () => {
    expect(sessionEnded(T / 1000 - 60, new Date(T))).toBe(true);
  });

  it("keeps a token minted after it, and one minted in the same second", () => {
    expect(sessionEnded(T / 1000 + 1, new Date(T))).toBe(false);
    expect(sessionEnded(T / 1000, new Date(T + 900))).toBe(false);
  });

  it("leaves alone a token with no minting time, and an account never stamped", () => {
    expect(sessionEnded(undefined, new Date(T))).toBe(false);
    expect(sessionEnded(T / 1000, null)).toBe(false);
    expect(sessionEnded(T / 1000, "not a date")).toBe(false);
  });
});

describe("the three pieces are in place", () => {
  it("every token the server mints carries its minting time", () => {
    const files = [
      "server/routers/auth.router.ts",
      "server/routers/portalCenter.router.ts",
      "server/_core/context.ts",
    ];
    for (const rel of files) {
      const src = read(rel);
      const mints = src.split("new SignJWT(").length - 1;
      expect(mints, `${rel} mints a token`).toBeGreaterThan(0);
      const stamped = src.split(".setIssuedAt()").length - 1;
      expect(stamped, `${rel}: every new SignJWT( needs .setIssuedAt()`).toBe(mints);
    }
  });

  it("a password change stamps the account, for staff and for customers", () => {
    const staff = read("server/db/admin.db.ts");
    const at = staff.indexOf("export async function updateUserPassword");
    expect(at).toBeGreaterThan(-1);
    expect(staff.slice(at, at + 400)).toContain("sessionsValidFrom: new Date()");

    const customer = read("server/db/customers.db.ts");
    const c = customer.indexOf("export async function updateCustomerPassword");
    expect(c).toBeGreaterThan(-1);
    expect(customer.slice(c, c + 900)).toContain("sessionsValidFrom: new Date()");
  });

  it("the request check reads the stamp for both kinds of account", () => {
    const sdk = read("server/_core/sdk.ts");
    expect(sdk).toContain("sessionEnded(session.issuedAt, customer.sessionsValidFrom)");
    expect(sdk).toContain("sessionEnded(session.issuedAt, user.sessionsValidFrom)");
    // The minting time comes out of the verified payload, nowhere else.
    expect(sdk).toMatch(/const issuedAt = typeof iat === "number" \? iat : undefined/);
  });

  it("the column exists on a fresh database and on an old one", () => {
    const migrations = read("server/_core/migrations.ts");
    expect(migrations).toContain('{ name: "customers.sessionsValidFrom"');
    expect(migrations).toContain('{ name: "users.sessionsValidFrom"');
    expect(migrations.split("sessionsValidFrom TIMESTAMP NULL\n    ) ENGINE").length - 1).toBe(2);
    const schema = read("drizzle/schema/users.schema.ts");
    expect(schema.split('timestamp("sessionsValidFrom")').length - 1).toBe(2);
  });
});
