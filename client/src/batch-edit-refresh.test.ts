import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A batch corrected is a batch recounted.
 *
 * The owner, 2026-09-21: a batch was created with the wrong price, the price
 * was corrected, and the money report still worked with the figures from
 * before the correction — the buying and selling rates, the profit per kg,
 * the weight detail and the per-customer analysis all computed from the old
 * row, with nothing on the screen to say which of the two was true.
 *
 * The report asks the server each time and the server computes it live, so
 * the stale figures came from the page's own cache: saving a batch refreshed
 * the list and nothing else.
 */

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8").replace(/\r\n/g, "\n");

describe("saving a batch", () => {
  const page = read("pages/Batches.tsx");
  const refresh = page.slice(page.indexOf("const refreshBatchLists = () => {"), page.indexOf("const onBatchCreateSuccess"));

  it("makes every screen of that batch ask again", () => {
    expect(refresh.length).toBeGreaterThan(100);
    expect(refresh).toContain("trpcUtilsForAudit.batches.invalidate();");
  });

  it("is what create, update and status changes all call", () => {
    for (const handler of ["const onBatchCreateSuccess", "const onBatchUpdateSuccess"]) {
      const at = page.indexOf(handler);
      expect(at, handler).toBeGreaterThan(-1);
      expect(page.slice(at, at + 400), handler).toContain("refreshBatchLists()");
    }
  });

  it("the money report still reads its figures from the server, not from a stored copy", () => {
    const report = read("pages/BatchFinancialReport.tsx");
    expect(report).toContain("trpc.batches.getFinancialSummary.useQuery({ batchId }");
  });
});
