import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { batchMatchesDesk, twinCodeFor, twinsBesideOriginal } from "./batchTwin";

/** Owner, 2026-10-29: AIR-2026-072GZ and its twin were renamed into each other. */
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the twin beside its original", () => {
  it("each twin straight after its original; a twin whose original is not listed stays where it is", () => {
    const rows = [{ id: 9, twinOfBatchId: 2 }, { id: 5 }, { id: 2 }, { id: 7, twinOfBatchId: 99 }];
    expect(twinsBesideOriginal(rows).map((r) => r.id)).toEqual([5, 2, 9, 7]);
  });

  it("its name is the original's with Erbil after it", () => {
    expect(twinCodeFor("AIR-2026-072GZ")).toBe("AIR-2026-072GZ Erbil");
  });

  it("the server refuses renaming a twin and renames it with its original", () => {
    const r = read("server/routers/batches.router.ts");
    expect(r).toContain("if (existing.twinOfBatchId && data.batchCode !== undefined && data.batchCode.trim() !== existing.batchCode) {");
    expect(r).toContain("await db.renameTwinsOf(id, data.batchCode.trim(), ctx.user.id);");
  });

  it("both rows say which is which", () => {
    const page = read("client/src/pages/Batches.tsx");
    expect(page).toContain('data-testid="batch-twin-chip"');
    expect(page).toContain('data-testid="batch-original-chip"');
    expect(page).toContain("twinsBesideOriginal(searchActive ? (searchQuery.data ?? []) : visibleBatches)");
  });
});

describe("a parcel goes only into a batch made where its desk is", () => {
  it("China desk: only China batches; Erbil desk: both; unknown: either (owner, 2026-10-29)", () => {
    expect(batchMatchesDesk(false, true)).toBe(false);
    expect(batchMatchesDesk(true, true)).toBe(true);
    expect(batchMatchesDesk(true, false)).toBe(true);
    expect(batchMatchesDesk(false, false)).toBe(true);
    expect(batchMatchesDesk(true, null)).toBe(true);
  });

  it("every register picker filters by it, and the server refuses the rest", () => {
    for (const f of ["client/src/pages/QuickRegister.tsx", "client/src/pages/BatchAssignmentScanner.tsx", "client/src/pages/BulkRegister.tsx", "client/src/pages/Packages.tsx"]) {
      expect(read(f), f).toContain("batchMatchesDesk(");
    }
    expect(read("server/routers/packages.router.ts").match(/await db\.assertBatchMatchesDesk\(input\.batchId, ctx\.user\.id\);/g)?.length).toBe(2);
    expect(read("server/routers/scanning.router.ts")).toContain("await db.assertBatchMatchesDesk(input.batchId, ctx.user.id);");
  });
});

describe("our kilos against the carrier's on every batch (owner, 2026-10-29)", () => {
  it("the strip reads the any-batch check and says when the carrier's kilos are missing", () => {
    const card = read("client/src/components/batches/CarrierGroupCard.tsx");
    expect(card).toContain("trpc.batches.carrierGroup.kgCheck.useQuery(");
    expect(card).toContain('data-state="no-carrier-kg"');
    expect(read("server/db/carrierGroup.db.ts")).toContain("export async function getBatchKgCheck(batchId: number) {");
  });
});

describe("the main admin sets his own place (owner, 2026-10-29)", () => {
  it("a card on the staff page, his own row being absent from the list", () => {
    expect(read("client/src/pages/StaffManagement.tsx")).toContain('data-testid="my-work-place-select"');
    expect(read("server/routers/auth.router.ts")).toContain("myWorkPlace: protectedProcedure.query(async ({ ctx }) => db.getUserWorkLocation(ctx.user.id)),");
  });
});
