import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The dashboard's problems (owner, 2026-11-05): each card carries its
 * records; four new box/batch faults; today's deliveries by the day they were
 * delivered; a box fault rings its own chime.
 */
const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const lib = read("db/dashboardProblems.db.ts");
const reports = read("db/reports.db.ts");
const page = read("../client/src/pages/dashboard/Dashboard.tsx");

describe("dashboard problems", () => {
  it("finds the four box and batch faults the owner named", () => {
    expect(lib).toContain("i.packageId IS NULL AND i.fullPackageOrderId IS NULL");
    expect(lib).toContain("CAST(COALESCE(p.weightKg, 0) AS DECIMAL(12,3)) <= 0");
    expect(lib).toContain("CAST(COALESCE(p.calculatedCostUsd, 0) AS DECIMAL(12,2)) <= 0");
    expect(lib).toContain("bt.status IN ('at_depot','delivered','closed')");
    expect(lib).toContain("s.scanType = 'received_local'");
  });

  it("only boxes still being worked", () => {
    expect(lib).toContain("b.status IN ('open','ready','in_transit')");
  });

  it("every card carries its records", () => {
    expect(reports).toContain("const recordsById = await getAlertRecords();");
    expect(page).toContain('data-testid="problem-records"');
  });

  it("today's deliveries are counted by the day they were delivered", () => {
    expect(reports).toContain("gte(packages.deliveredAt, todayStart)");
    expect(reports).not.toContain("gte(packages.updatedAt, todayStart)");
  });

  it("a box fault rings its own chime, once a visit", () => {
    expect(page).toContain('sessionStorage.getItem("wazn-dash-box-chime")');
    expect(page).toContain("soundManager.playRiskChime()");
  });
});
