import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * «باچی چالاک» read the length of the five-row list and never passed 5; two
 * captions said what the figure was not (audit 2026-11-05).
 */
const page = readFileSync(resolve(__dirname, "../pages/dashboard/Dashboard.tsx"), "utf8");
const db = readFileSync(resolve(__dirname, "../../../server/db/reports.db.ts"), "utf8");

describe("dashboard active batches", () => {
  it("counts every active shipment, by the list's own status set", () => {
    expect(db).toContain("export async function countDashboardActiveBatches()");
    expect(page).toContain("trpc.dashboard.activeBatchCount.useQuery()");
    expect(page).not.toContain("activeBatches?.length || 0}");
  });

  it("captions say what is counted", () => {
    expect(page).toContain("هەموو کڕیارە تۆمارکراوەکان");
    expect(page).toContain("هەموو پاکەتەکان، لە سەرەتاوە");
    expect(page).toContain("ئامادەکردن، لە ڕێگا یان لە کۆگا");
  });
});
