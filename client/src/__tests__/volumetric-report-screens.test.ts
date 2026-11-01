import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/** Owner, 2026-10-23: volumetric figures by batch, customer and box - for the office only. */
describe("the volumetric report", () => {
  it("for accountants and up, never the customer", () => {
    expect(read("server/routers/reports.router.ts")).toContain("volumetric: accountantProcedure");
  });

  it("one page with four tabs, in the reports menu", () => {
    const page = read("client/src/pages/VolumetricReport.tsx");
    for (const t of ["batch", "customer", "box", "parcel"]) expect(page).toContain(`{ key: "${t}"`);
    expect(read("client/src/App.tsx")).toContain('<Route path="/reports/volumetric" component={VolumetricReport} />');
    expect(read("client/src/components/DashboardLayout.tsx")).toContain('path: "/reports/volumetric" }');
  });

  it("the batch's own report shows it against the carrier, air only", () => {
    expect(read("client/src/pages/BatchFinancialReportFull.tsx")).toContain('{batch.shippingType !== "sea" && <BatchVolumetricCard batchId={batchId} language={language} />}');
  });
});

/** Owner, 2026-10-23: Quick Register warns when the volume weighs more than twice the scale. */
describe("the twice-the-scale warning", () => {
  it("in Quick Register, pulsing", () => {
    const src = read("client/src/pages/QuickRegister.tsx");
    expect(src).toContain("{byVolume && actual > 0 && volumetricWeight >= actual * 2 && (");
    expect(src).toContain('data-testid="qr-volumetric-double"');
  });
});
