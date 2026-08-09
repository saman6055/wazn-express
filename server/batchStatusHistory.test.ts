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
