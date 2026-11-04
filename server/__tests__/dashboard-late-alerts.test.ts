import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Late parcels and batches (audit 2026-11-05): counted on the server over all
 * of them, parcels already in Erbil never late, a batch at the depot never
 * late, and «1–5 days past the ETA» is said as such.
 */
const lib = readFileSync(resolve(__dirname, "../db/dashboardProblems.db.ts"), "utf8");
const page = readFileSync(resolve(__dirname, "../../client/src/pages/dashboard/Dashboard.tsx"), "utf8");

describe("late alerts", () => {
  it("a parcel is late only while it has not reached Erbil, is claimed and not lost", () => {
    expect(lib).toContain("p.status IN ('registered','in_batch','in_transit')");
    expect(lib).toContain("COALESCE(p.isUnclaimed, 0) = 0");
    expect(lib).toContain("p.lostAt IS NULL");
    expect(lib).not.toContain("LIMIT 500");
  });

  it("a batch at the depot is not late; the warning says past the ETA", () => {
    expect(lib).toContain("status NOT IN ('arrived','at_depot','delivered','closed')");
    expect(lib).toContain("1–5 ڕۆژ لە ETA تێپەڕیوە");
  });

  it("the dashboard reads the server's counts, not the 50 newest batches", () => {
    const section = page.slice(page.indexOf("function AlertSummarySection()"));
    expect(section).toContain("trpc.dashboard.lateAlerts.useQuery()");
    expect(section.slice(0, 1200)).not.toContain("trpc.batches.list.useQuery()");
  });
});
