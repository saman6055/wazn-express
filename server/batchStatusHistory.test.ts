import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, "../drizzle/schema/batches.schema.ts"), "utf8");
const MIGRATIONS = fs.readFileSync(
  path.resolve(__dirname, "_core/migrations.ts"), "utf8");

/**
 * A batch carries three timestamps of its own — created, departed, arrived —
 * and nothing else. So the customer's journey stepper showed a date for the
 * first three steps and never for customs, the Erbil depot or delivery: a
 * shipment that had reached the customer displayed six green steps and one
 * date, the oldest of them. On a sea batch that is two months of silence.
 */
describe("a batch records when it moved", () => {
  const table = SCHEMA.slice(
    SCHEMA.indexOf("export const batchStatusHistory"),
    SCHEMA.indexOf("export type BatchStatusHistory"),
  );

  it("keeps where it came from as well as where it went", () => {
    // A status corrected back and forth must leave both moves on the record,
    // which is the reason this is a history and not three more columns.
    expect(table).toContain('fromStatus: varchar("fromStatus"');
    expect(table).toContain('toStatus: varchar("toStatus"');
  });

  it("says who made the change", () => {
    // Nullable: a background job is not a person, and inventing a user id for
    // one would be worse than recording none.
    expect(table).toContain('changedById: int("changedById")');
    expect(table, "must not be notNull — system changes have no author")
      .not.toMatch(/changedById: int\("changedById"\)\.notNull\(\)/);
  });

  /**
   * The line that matters most. This table records state and time. The moment
   * a price, a weight or a charge flag appears on it, something will start
   * deciding money from a log — and a log is the wrong place to decide money
   * from, because rows can be written twice.
   */
  it("holds nothing financial", () => {
    for (const forbidden of ["Usd", "price", "cost", "profit", "amount", "isCharged", "invoice"]) {
      expect(table.toLowerCase(), `${forbidden} does not belong on a status log`)
        .not.toContain(forbidden.toLowerCase());
    }
  });

  it("is indexed for the way it is read", () => {
    // The portal reads a whole batch's history at once.
    expect(table).toContain("idx_bsh_batch_id");
  });

  /**
   * The live database predates this table, so it has to be created on boot
   * like every other one — the schema alone changes nothing on a server that
   * is already running.
   */
  it("is created on a database that does not have it", () => {
    expect(MIGRATIONS).toContain('name: "batchStatusHistory"');
    expect(MIGRATIONS).toContain("CREATE TABLE IF NOT EXISTS batchStatusHistory");
    expect(MIGRATIONS, "batches must exist first").toMatch(/dependencies: \["batches", "users"\]/);
  });

  it("the SQL and the schema agree on the columns", () => {
    const sql = MIGRATIONS.slice(
      MIGRATIONS.indexOf("CREATE TABLE IF NOT EXISTS batchStatusHistory"),
      MIGRATIONS.indexOf("ENGINE=InnoDB", MIGRATIONS.indexOf("CREATE TABLE IF NOT EXISTS batchStatusHistory")),
    );
    for (const col of ["batchId", "fromStatus", "toStatus", "changedById", "changedAt"]) {
      expect(sql, `${col} missing from the CREATE TABLE`).toContain(col);
      expect(table, `${col} missing from the drizzle schema`).toContain(col);
    }
  });
});

describe("the move is recorded where the move happens", () => {
  const DB = fs.readFileSync(path.resolve(__dirname, "db/batches.db.ts"), "utf8");
  const ROUTER = fs.readFileSync(path.resolve(__dirname, "routers/batches.router.ts"), "utf8");
  const fn = DB.slice(DB.indexOf("export async function updateBatch"), DB.indexOf("export async function getActiveBatches"));

  /**
   * In updateBatch, not in the routers that call it. A fourth caller added
   * next year would otherwise have to remember — and forgetting to write a
   * link is precisely how a parcel with a real order number ended up in the
   * customer's portal as goods they had bought themselves.
   */
  it("is written in the one place a batch status changes", () => {
    expect(fn).toContain("db.insert(batchStatusHistory)");
    // And nowhere else, so there is one path.
    const inserts = DB.match(/db\.insert\(batchStatusHistory\)/g) ?? [];
    expect(inserts.length).toBe(1);
  });

  it("records where it came from as well as where it went", () => {
    expect(fn).toContain("fromStatus: previousStatus");
    expect(fn).toContain("toStatus: nextStatus");
  });

  /**
   * updateBatch is also called to bump a package count. A row saying
   * "arrived → arrived" every time a parcel is added would bury the six that
   * mean something.
   */
  it("writes nothing when the status did not change", () => {
    expect(fn).toMatch(/nextStatus !== undefined && nextStatus !== previousStatus/);
    // And does not pay for a lookup on an update that cannot change it.
    expect(fn).toMatch(/if \(nextStatus !== undefined\) \{/);
  });

  /**
   * A shipment's status must never fail to save because its history could not
   * be written. The move has already happened; losing the note about it costs
   * a date on a timeline, not the state itself.
   */
  it("a failed history write does not fail the status change", () => {
    const at = fn.indexOf("db.insert(batchStatusHistory)");
    const around = fn.slice(at - 200, at + 500);
    expect(around).toContain("try {");
    expect(around).toContain("catch");
    expect(around).toContain("appLogger.error");
  });

  it("says who made the change when a person made it", () => {
    expect(fn).toContain("changedById: changedById ?? null");
    // Both routers that change a status pass the acting user.
    const calls = ROUTER.match(/db\.updateBatch\([^)]*ctx\.user\.id\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * The list screen draws a stepper per card. Reading the history per batch
   * would be one query per row — the fan-out this codebase has had to undo
   * twice already.
   */
  it("reads a whole set of batches in one query", () => {
    const reader = DB.slice(DB.indexOf("export async function getBatchStatusTimestamps"));
    expect(reader.slice(0, 1600)).toContain("inArray(batchStatusHistory.batchId, batchIds)");
    expect(reader.slice(0, 1600), "first time it reached each status, not the last")
      .toContain("if (!existing[row.toStatus])");
  });
});
