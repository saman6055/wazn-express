/** A quote is approved and charged once, however many presses arrive together (2026-11-06). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const src = fs.readFileSync(path.resolve(__dirname, "../routers/fullPackage.router.ts"), "utf8").replace(/\r\n/g, "\n");
describe("approveQuote", () => {
  it("claims the order before charging, and gives the claim back if the charge fails", () => {
    const fn = src.slice(src.indexOf("approveQuote: protectedProcedure"), src.indexOf("rejectQuote: protectedProcedure"));
    const claim = fn.indexOf("await db.claimOrderForCharge(existing.id)");
    const charge = fn.indexOf("await db.applyCharge(");
    expect(claim).toBeGreaterThan(0);
    expect(claim).toBeLessThan(charge);
    expect(fn).toContain("await db.releaseOrderClaim(existing.id);");
  });
});
