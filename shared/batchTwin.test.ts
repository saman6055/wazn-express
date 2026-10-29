import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { batchMatchesDesk, twinCodeFor, twinsBesideOriginal } from "./batchTwin";

/** Owner, 2026-10-29: AIR-2026-072GZ and its twin were renamed into each other. */
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the twin beside its original", () => {
  it("each twin straight after its original, the pair where the higher of them stood; a twin whose original is not listed stays where it is", () => {
    const rows = [{ id: 9, twinOfBatchId: 2 }, { id: 5 }, { id: 2 }, { id: 7, twinOfBatchId: 99 }];
    expect(twinsBesideOriginal(rows).map((r) => r.id)).toEqual([2, 9, 5, 7]);
    // Original above: the pair stays there.
    expect(twinsBesideOriginal([{ id: 2 }, { id: 5 }, { id: 9, twinOfBatchId: 2 }]).map((r) => r.id)).toEqual([2, 9, 5]);
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
  it("each desk only its own place's batches; unknown: either (owner, 2026-10-29)", () => {
    expect(batchMatchesDesk(false, true)).toBe(false);
    expect(batchMatchesDesk(true, true)).toBe(true);
    expect(batchMatchesDesk(true, false)).toBe(false);
    expect(batchMatchesDesk(false, false)).toBe(true);
    expect(batchMatchesDesk(true, null)).toBe(true);
  });

  it("the arrival check offers China batches still being checked in, never an Erbil one", async () => {
    const { batchOpenForArrivalCheck } = await import("./batchTwin");
    expect(batchOpenForArrivalCheck({ status: "at_depot", madeInChina: true })).toBe(true);
    expect(batchOpenForArrivalCheck({ status: "in_transit", madeInChina: true })).toBe(true);
    expect(batchOpenForArrivalCheck({ status: "at_depot", madeInChina: false })).toBe(false);
    expect(batchOpenForArrivalCheck({ status: "closed", madeInChina: true })).toBe(false);
    expect(read("client/src/pages/ArrivalVerificationScanner.tsx")).toContain("batchOpenForArrivalCheck(b) || again.has(b.id)");
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

describe("a batch with Erbil in its name was made in Iraq (owner, 2026-10-29)", () => {
  it("filled before the creator rule, only where no place is stamped", () => {
    const m = read("server/_core/migrations.ts");
    const name = m.indexOf('name: "backfill.batches.erbilNameIsIraq"');
    expect(name).toBeGreaterThan(0);
    expect(name).toBeLessThan(m.indexOf('name: "backfill.batches.createdInLocation"'));
    expect(m).toContain("WHERE b.createdInCountryId IS NULL AND LOWER(b.batchCode) LIKE '%erbil%'`");
  });
});

describe("a batch in a carrier group shows only the group's invoice (owner, 2026-10-29)", () => {
  it("its own carrier weight, loads, difference line and cost inputs are hidden; outside a group the card shows only the twin button", () => {
    const page = read("client/src/pages/Batches.tsx");
    expect(page).toContain('{editingBatch.shippingType !== "sea" && !editInGroup && (');
    expect(page).toContain("{!editInGroup && <CarrierDifferenceLine");
    expect(page).toContain('data-testid="batch-cost-from-group"');
    const card = read("client/src/components/batches/CarrierGroupCard.tsx");
    expect(card).toContain("if (!g && !canTwin) return null;");
    expect(card).toContain("{g && (");
  });
});

describe("a batch that came partly on this load (owner, 2026-10-29, AIR-2026-069)", () => {
  it("only its parcels checked in from the load's day count, and its share becomes a load of its own", () => {
    const db = read("server/db/carrierGroup.db.ts");
    expect(db).toContain("const partial = !!arrivedOn && all.some((p) => (firstScan.get(p.id) ?? \"9999\") < arrivedOn);");
    expect(db).toContain("const mineLoad = parts.find((p) => p.note === g.key);");
    expect(read("server/db/carrierParts.db.ts")).toContain("costUsd: decimalOrNull(batch.shippingCost) ?? decimalOrNull(firstLoadCost(batch)),");
    expect(read("client/src/components/batches/CarrierGroupCard.tsx")).toContain('data-testid="carrier-group-day"');
    expect(read("server/_core/migrations.ts")).toContain('"carrierGroupInvoices.arrivedOn"');
  });
});
