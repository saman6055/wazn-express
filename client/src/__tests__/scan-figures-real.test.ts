import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", "..", p), "utf8");

/**
 * Owner, 2026-11-05: «هەر هەموو ئەو شتانەی ناردمم هەڵەی تێدا نەبێ و داتاکانی
 * سەتا سەت دروست ببێت». The scan report showed 0 on every station and the
 * scan dashboard drew a random week.
 */
describe("scan figures come from the scans", () => {
  it("the report's rows are flat, so the page can read scanType and scannedAt", () => {
    const db = read("server/db/scanning.db.ts");
    const fn = db.slice(db.indexOf("export async function getScansByDateRange"), db.indexOf("export async function getScanStatsByDateRange"));
    expect(fn).toContain("scanType: packageScans.scanType,");
    expect(fn).toContain("scannedAt: packageScans.scannedAt,");
    expect(fn).toContain("scannedBy: users.name,");
    expect(fn).not.toContain("scan: packageScans,");
    // The end date counts as a whole day, today included.
    expect(fn).toContain("lt(packageScans.scannedAt, endExclusive)");
  });

  it("the dashboard counts every station from its own event, never made up", () => {
    const page = read("client/src/pages/scanning/ScanDashboard.tsx");
    expect(page).not.toContain("Math.random()");
    expect(page).toContain("trpc.scanning.stationActivity.useQuery");
    // The waiting line opens the list with the same rows.
    expect(page).toContain('packagesHref({ tab: "no_batch" })');
    const db = read("server/db/stationActivity.db.ts");
    expect(db).toContain('eq(auditLogs.action, "assign_package_to_batch")');
    expect(db).toContain('eq(packageScans.scanType, "received_local")');
    expect(db).toContain("packages.registeredAt");
    expect(db).toContain("packages.deliveredAt");
  });
});
