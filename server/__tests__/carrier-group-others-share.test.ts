/** A carrier load's late cartons of other batches share its invoice by kilos (owner, 2026-11-12, ANC 171 172). */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const src = readFileSync(resolve(__dirname, "../db/carrierGroup.db.ts"), "utf8").replace(/\r\n/g, "\n");
describe("carrier group: others share", () => {
  it("the split counts the other batches' late cartons, a member last", () => {
    expect(src).toContain("...others.filter((o) => o.kg > 0 && !memberIdSet.has(o.batchId)).map((o) => ({ batchId: o.batchId, kg: o.kg })),");
    expect(src).toContain(": splitGroupInvoice(sharers, billedKg!, costUsd!);");
  });
  it("their share is one more load on their own batch, named for the group, updated not doubled", () => {
    expect(src).toContain("for (const o of g.others) {");
    expect(src).toContain("const mineLoad = parts.find((p) => p.note === g.key);");
  });
});
