/**
 * An open box's lines read what its payment screen asks (owner, 2026-11-04).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("one figure on the box and its payment screen", () => {
  const src = read("server/db/deliveryBoxes.db.ts");
  const fn = src.slice(src.indexOf("export async function syncBoxLinesToTill("), src.indexOf("export async function recalculateBoxTotals("));

  it("writes the payment screen's figure on each line, open and unreceipted boxes only", () => {
    expect(fn).toContain('box.status === "delivered" || box.status === "cancelled"');
    expect(fn).toContain('eq(boxSettlements.status, "confirmed")');
    expect(fn).toContain("Number(parcel.chargedUsd || 0)");
  });

  it("runs whenever the totals are worked out, and when a box is opened", () => {
    const totals = src.slice(src.indexOf("export async function recalculateBoxTotals("));
    expect(totals.indexOf("await syncBoxLinesToTill(boxId);")).toBeLessThan(totals.indexOf("const items = await getBoxItems(boxId);"));
    expect(read("server/routers/scanning.router.ts")).toContain("if (await db.syncBoxLinesToTill(input.id)) await db.recalculateBoxTotals(input.id);");
  });
});
