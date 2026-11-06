/** A parcel is in one box only, asked under a lock where the line is written (2026-11-06). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const src = fs.readFileSync(path.resolve(__dirname, "../db/deliveryBoxes.db.ts"), "utf8").replace(/\r\n/g, "\n");
describe("addItemToBox", () => {
  it("locks the parcel, asks again, and writes the line in one transaction", () => {
    const fn = src.slice(src.indexOf("export async function addItemToBox("), src.indexOf("async function chargeOrdersForBoxQuietly("));
    const lock = fn.indexOf('.for("update")');
    const ask = fn.indexOf('ne(deliveryBoxes.status, "cancelled")');
    const insert = fn.indexOf("tx.insert(deliveryBoxItems)");
    expect(lock).toBeGreaterThan(0);
    expect(lock).toBeLessThan(ask);
    expect(ask).toBeLessThan(insert);
  });
});
