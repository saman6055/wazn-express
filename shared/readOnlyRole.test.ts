import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { AUDITOR_ROLE, isReadOnlyRole, mayPerform, READ_ONLY_REFUSAL } from "./readOnlyRole";

describe("who is read-only", () => {
  it("is the auditor and nobody else", () => {
    expect(isReadOnlyRole(AUDITOR_ROLE)).toBe(true);
    for (const role of ["super_admin", "admin", "employee", "accountant", "customer"]) {
      expect(isReadOnlyRole(role), `${role} must keep working`).toBe(false);
    }
  });

  it("treats a missing role as not read-only", () => {
    // A null role means "not signed in", which the auth layer refuses first.
    // Answering true here would be a second opinion on a question already
    // settled, and the wrong one to give if the two ever disagreed.
    expect(isReadOnlyRole(null)).toBe(false);
    expect(isReadOnlyRole(undefined)).toBe(false);
  });
});

describe("what an auditor may run", () => {
  it("reads freely", () => {
    expect(mayPerform(AUDITOR_ROLE, "query")).toBe(true);
    expect(mayPerform(AUDITOR_ROLE, "subscription")).toBe(true);
  });

  it("writes nothing", () => {
    expect(mayPerform(AUDITOR_ROLE, "mutation")).toBe(false);
  });

  it("leaves every other role alone", () => {
    for (const role of ["super_admin", "admin", "employee", "accountant", "customer"]) {
      expect(mayPerform(role, "mutation"), `${role} lost the ability to write`).toBe(true);
    }
  });
});

describe("the rule is actually wired in", () => {
  // The module above is only a description of the rule. These read the two
  // files that have to consult it — a passing unit test next to a middleware
  // that never calls it would be worse than no test, because it would say the
  // system was safe while every mutation went through.
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

  it("guards the one place every authenticated call passes through", () => {
    const trpc = read("server/_core/trpc.ts");

    expect(trpc, "requireUser no longer imports the rule").toContain("mayPerform");
    expect(trpc, "the refusal message is not the shared one").toContain("READ_ONLY_REFUSAL");
    // opts.type is what makes this one check instead of 279. If the middleware
    // stops reading it, it is inspecting something else and this is no longer
    // a blanket rule.
    expect(trpc).toMatch(/mayPerform\(\s*ctx\.user[^)]*type/s);
  });

  it("leaves no second admin door that skips it", () => {
    // There were two adminProcedures: one built on protectedProcedure and one
    // built straight on t.procedure, which the system settings router used.
    // The second never passed through requireUser, so the rule above would
    // have missed its three mutations entirely.
    const trpc = read("server/_core/trpc.ts");
    const bare = [...trpc.matchAll(/export const (\w+Procedure)\s*=\s*t\.procedure(?!\.use\(requireUser)/g)]
      .map((m) => m[1])
      .filter((name) => name !== "publicProcedure");

    expect(bare, "this procedure bypasses requireUser and so bypasses the read-only rule").toEqual([]);
  });

  it("keeps the auditor in every list of staff roles", () => {
    // The role is useless if it cannot reach the data. staffProcedure carries
    // the operational reads, accountantProcedure the financial ones.
    const auth = read("server/middleware/auth.ts");
    const staffLine = auth.match(/staffProcedure[\s\S]*?includes\(ctx\.user\.role\)/)?.[0] ?? "";
    const accountantLine = auth.match(/accountantProcedure[\s\S]*?includes\(ctx\.user\.role\)/)?.[0] ?? "";

    expect(staffLine, "auditor cannot read the operational side").toContain(AUDITOR_ROLE);
    expect(accountantLine, "auditor cannot read the finance side").toContain(AUDITOR_ROLE);
  });

  it("is a role the database will accept", () => {
    // The column is an enum. Without the migration the account cannot be
    // created at all, and the failure arrives as a truncated-data error
    // nobody would connect to this feature.
    const migrations = read("server/_core/migrations.ts");
    expect(migrations).toMatch(new RegExp(`ALTER TABLE users MODIFY COLUMN role ENUM\\([^)]*'${AUDITOR_ROLE}'`));

    const schema = read("drizzle/schema/users.schema.ts");
    expect(schema).toContain(`"${AUDITOR_ROLE}"`);
  });

  it("tells the caller why in a language they read", () => {
    expect(READ_ONLY_REFUSAL.length).toBeGreaterThan(20);
    expect(READ_ONLY_REFUSAL).toMatch(/[؀-ۿ]/);
  });
});
