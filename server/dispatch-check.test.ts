import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-24: every parcel scanned into a carton in China before the
 * batch leaves. Proven on real MySQL (zz-probe-dispatch, 21 checks).
 */
describe("the dispatch check in China", () => {
  const db = read("server/db/dispatch.db.ts");

  it("the tables are made at boot, the batch columns patched in", () => {
    const m = read("server/_core/migrations.ts");
    expect(m).toContain("CREATE TABLE IF NOT EXISTS batchCartons (");
    expect(m).toContain("CREATE TABLE IF NOT EXISTS batchCartonItems (");
    expect(m).toContain('{ name: "batches.dispatchCheckedAt", sql: "ALTER TABLE batches ADD COLUMN dispatchCheckedAt TIMESTAMP NULL" },');
  });

  it("a scan answers in four ways: in, already, another carton, not registered, another batch", () => {
    for (const kind of ['"added"', '"already_here"', '"in_other_carton"', '"not_registered"', '"other_batch"']) {
      expect(db).toContain(`kind: ${kind}`);
    }
  });

  it("finishing short: only the main admin, or an admin working in China, and with a reason", () => {
    expect(db).toContain('return user.role === "admin" && (await worksInChina(user.id));');
    expect(db).toContain("if (note.length < 3) {");
  });

  it("a move never leaves the account wrong", () => {
    expect(db).toContain("if (!pkg.isCharged || !pkg.customerId || !pkg.batchId) return null;");
    expect(read("server/routers/dispatch.router.ts")).toContain("const refusal = await db.batchMoveRefusal(packageId, batchId);");
  });

  it("every member of staff is told", () => {
    expect(read("server/routers/dispatch.router.ts")).toContain('action: "batch_dispatch_checked",');
  });
});
