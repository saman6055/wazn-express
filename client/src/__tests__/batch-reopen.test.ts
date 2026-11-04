import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8");

/**
 * A closed batch opens again only by the main admin's hand, with a reason,
 * back to the Erbil depot, and nothing else moves (owner, 2026-11-03).
 */
describe("reopening a closed batch", () => {
  const router = read("server/routers/batches.router.ts");
  const start = router.indexOf("    reopen: staffProcedure");
  const body = router.slice(start, router.indexOf("    updateStatus: staffProcedure", start));

  it("is the main admin's alone, with a reason", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('ctx.user.role !== "super_admin"');
    expect(body).toContain("why.length < 3");
    expect(body).toContain('batch.status !== "closed"');
  });

  it("goes back to the depot and writes no money", () => {
    expect(body).toContain('{ status: "at_depot" }');
    expect(body).toContain('action: "reopen_batch"');
    expect(body).not.toMatch(/charge|ledger|settlement|invoice/i);
  });

  it("is offered only on a closed batch, to the main admin", () => {
    const page = read("client/src/pages/batches/Batches.tsx");
    expect(page).toContain('batch.status === "closed" && isSuperAdmin(userRole)');
    expect(page).toContain("<ReopenBatchDialog");
  });
});
