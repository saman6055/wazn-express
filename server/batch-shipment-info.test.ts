import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Three rules about a batch's shipping identifiers, each of which was broken
 * or absent before this feature existed.
 *
 * 1. The air waybill and container number are never known when a batch is
 *    created — the cartons are still being filled — so both must be editable
 *    afterwards. The container number was offered ONLY on the create form,
 *    which meant an existing batch could never record the number the carrier
 *    and customs both quote back at you.
 *
 * 2. The courier trackings the cartons travelled to the depot under are
 *    internal. They cover every customer in the batch, so handing them to the
 *    portal would let one customer follow another's goods.
 *
 * 3. Both new columns must be additive and nullable, so the migration is safe
 *    to run against a live database with existing batches.
 *
 * Source-text assertions rather than a live DB, because this repo's tests run
 * without one. Each slice is checked to be non-empty first — an unmatched
 * marker must fail loudly rather than silently assert against "".
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

function slice(src: string, startMarker: string, endMarker: string, label: string): string {
  const start = src.indexOf(startMarker);
  expect(start, `${label}: start marker "${startMarker}" not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start + startMarker.length);
  expect(end, `${label}: end marker "${endMarker}" not found after start`).toBeGreaterThan(start);
  const body = src.slice(start, end);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

describe("batch shipment identifiers", () => {
  it("the air waybill and container number can be edited after creation", () => {
    const router = read("server/routers/batches.router.ts");
    const update = slice(router, "update: staffProcedure", ".mutation(", "batches.update input");
    for (const field of ["awbNumber", "containerNumber", "vesselName", "flightNumber", "airlineName"]) {
      expect(update, `${field} must be updatable — it is not known at creation time`).toContain(field);
    }

    // The form has to offer them too: the server accepting a field the edit
    // dialog never renders is exactly the state this replaced.
    const page = read("client/src/pages/Batches.tsx");
    const editForm = slice(page, "const handleEdit", "const openEditDialog", "handleEdit body");
    for (const field of ["awbNumber", "containerNumber", "shipmentTrackings", "cartonCount"]) {
      expect(editForm, `${field} must be sent by the edit form`).toContain(field);
    }
  });

  it("the internal courier trackings never reach the customer portal", () => {
    const portalDb = read("server/db/portal.db.ts");
    const fn = slice(
      portalDb,
      "export async function getCustomerBatches",
      "export async function getCustomerPackagesInBatch",
      "getCustomerBatches"
    );
    // The whole batch row is spread into the portal payload, so the internal
    // field must be destructured away explicitly before that spread.
    expect(fn, "shipmentTrackings must be stripped from the portal payload")
      .toMatch(/shipmentTrackings:\s*_\w+\s*,\s*\.\.\./);
    expect(fn, "the portal payload must not spread the raw batch row")
      .not.toMatch(/return\s*\{\s*\.\.\.batch\s*,/);
  });

  it("the batch list carries every field the edit dialog writes back", () => {
    // The edit dialog is populated from a row of the LIST query, not from a
    // fresh fetch of the batch. That query names its columns explicitly, so
    // one left out arrives as undefined, renders as an empty field, and is
    // saved back over a real value. Trackings and carton count are sent
    // unconditionally by the form, so for those the loss is silent.
    const listQuery = slice(
      read("server/db/batches.db.ts"),
      "export async function getAllBatches",
      "export async function getBatchById",
      "getAllBatches"
    );
    for (const field of [
      "awbNumber",
      "containerNumber",
      "vesselName",
      "airlineName",
      "flightNumber",
      "shippingCompany",
      "shipmentTrackings",
      "cartonCount",
    ]) {
      expect(listQuery, `${field} must be selected — the edit form writes it back`)
        .toContain(`${field}: batches.${field}`);
    }
  });

  it("the new columns are additive and nullable, safe on live data", () => {
    const migrations = read("server/_core/migrations.ts");
    for (const col of ["awbNumber", "shipmentTrackings", "cartonCount"]) {
      const patch = migrations.match(new RegExp(`name: "batches\\.${col}", sql: "([^"]+)"`));
      expect(patch, `missing schema patch for batches.${col}`).not.toBeNull();
      const sql = patch![1];
      expect(sql, `${col} must be ADD COLUMN`).toContain("ADD COLUMN");
      expect(sql, `${col} must be nullable — existing batches have no value`).not.toContain("NOT NULL");
    }
  });
});
