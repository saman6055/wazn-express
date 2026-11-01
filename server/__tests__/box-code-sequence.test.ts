import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 2026-10-18: a box of the day was deleted, leaving 001 and 003; the code was
 * "how many today + 1" = 003, already taken, and every new box that day was
 * refused. The next number follows the highest one, never the count.
 */
describe("box codes follow the highest number of the day", () => {
  const src = readFileSync("server/db/deliveryBoxes.db.ts", "utf8");
  const gen = src.slice(src.indexOf("export async function generateBoxCode"), src.indexOf("// ============ DELIVERY BOX CRUD"));

  it("reads the highest number, not a count", () => {
    expect(gen.length).toBeGreaterThan(100);
    expect(gen).toContain("MAX(CAST(SUBSTRING(boxCode,");
    expect(gen).not.toContain("COUNT(*)");
  });
});
