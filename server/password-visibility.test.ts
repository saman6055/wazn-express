import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The office needs to answer "what is my password?" — and cannot.
 *
 * Passwords are bcrypt-hashed, which is one-way on purpose. Keeping a
 * readable copy so staff could recite it would mean one database leak
 * exposing every customer's password, and — because people reuse them —
 * their other accounts too.
 *
 * So the security panel answers the question behind the question instead:
 * is this account still on the password we handed out, or one the customer
 * chose? The first can be read back; the second can only be reset, which is
 * one tap away on the same panel.
 *
 * These tests exist because "just store it in plain text" is the obvious
 * shortcut, and it would be easy to add later without anyone noticing.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("passwords are never readable", () => {
  it("is still hashed everywhere it is set", () => {
    for (const file of ["server/routers/portal.router.ts", "server/routers/auth.router.ts"]) {
      const src = read(file);
      const sets = [...src.matchAll(/updateCustomerPassword\(|updateUserPassword\(/g)];
      expect(sets.length, `${file} sets a password somewhere`).toBeGreaterThan(0);
      expect(src, `${file} must hash it`).toContain("bcrypt.hash");
    }
  });

  it("no column holds a readable password", () => {
    const schema = read("drizzle/schema/users.schema.ts");
    // passwordHash is the only one there should ever be.
    expect(schema).not.toMatch(/\bpasswordPlain\b|\bplainPassword\b|\bpasswordText\b/);
    expect(schema).toContain("passwordHash");
  });

  it("the security panel returns no password, only its status", () => {
    const src = read("server/routers/portalCenter.router.ts");
    const start = src.indexOf("getCustomerSecurity");
    const body = src.slice(start, src.indexOf("}),", start));
    expect(body.length).toBeGreaterThan(100);

    // What it may say.
    expect(body).toContain("isOnDefaultPassword");
    expect(body).toContain("passwordChangedAt");
    // What it must never send.
    expect(body).not.toMatch(/passwordHash:/);
  });
});

describe("telling a default password from a chosen one", () => {
  it("is worked out by comparing, not by storing a flag", () => {
    // A stored flag drifts the moment anything sets a password without
    // remembering to update it. Comparing against the known default is
    // always right, and keeps nothing.
    const src = read("server/routers/portalCenter.router.ts");
    expect(src).toContain("bcrypt.compare(DEFAULT_RESET_PASSWORD");
  });

  it("stamps the time only when the customer chose it themselves", () => {
    const db = read("server/db/customers.db.ts");
    const start = db.indexOf("export async function updateCustomerPassword");
    const body = db.slice(start, db.indexOf("\n}", start));
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain("changedByCustomer");
    // A staff reset clears it: the account is back on a password we know,
    // and leaving a stale "customer set this" stamp would say the opposite.
    expect(body).toMatch(/changedByCustomer \? new Date\(\) : null/);
  });

  it("the portal marks a customer's own change as theirs", () => {
    const portal = read("server/routers/portal.router.ts");
    expect(portal).toContain("changedByCustomer: true");
  });

  it("the panel never prints a password the customer chose", () => {
    const page = read("client/src/pages/PortalCenter.tsx");
    // The default may be shown — we handed it out, and reading it back is
    // the whole point. Anything else must not be.
    expect(page).toContain("isOnDefaultPassword");
    expect(page).not.toMatch(/sec\.password(?!ChangedAt)/);
  });
});
