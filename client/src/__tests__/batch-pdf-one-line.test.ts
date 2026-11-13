import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Owner's report, 2026-11-13: a long name wrapped onto a second line and ran into the next row. */
describe("batch report PDF cells stay on one line", () => {
  it("every cell is given a height so pdfkit cuts it to «…»", () => {
    const pdf = readFileSync(resolve(__dirname, "..", "..", "..", "server/services/pdfReports.ts"), "utf8");
    expect(pdf).toContain(".text(cell.t.trim(), x, y + 4, { width: w, height: 10, align: al, lineBreak: false, ellipsis: true });");
  });
});
