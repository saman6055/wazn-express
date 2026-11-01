import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * Owner, 2026-10-04: a batch found by search, its financial analysis opened,
 * and on coming back the search was gone. It is kept for the tab now.
 */
describe("the batch search survives a visit to the batch", () => {
  const page = readFileSync(resolve(__dirname, "pages/Batches.tsx"), "utf8");
  it("starts from what was searched and keeps it while it is there", () => {
    expect(page).toContain("sessionStorage.getItem(BATCH_SEARCH_KEY)");
    expect(page).toContain("sessionStorage.setItem(BATCH_SEARCH_KEY, searchText)");
    expect(page).toContain("sessionStorage.removeItem(BATCH_SEARCH_KEY)");
  });
});
