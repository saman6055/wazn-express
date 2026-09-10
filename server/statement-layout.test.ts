import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

vi.mock("./db", () => ({ getDb: vi.fn(async () => null) }));

import { generateCustomerPDF } from "./services/pdfReports";

/**
 * The customer statement: one slim header, one summary strip, and Kurdish
 * that reads in the right order.
 *
 * The owner, looking at the first page (September 2026): a navy block, a
 * customer card and three cards took a third of the sheet before the first
 * row, and said the payments and the balance twice. And pdfkit, which sets
 * words left to right, printed every Kurdish phrase back to front.
 */

const SRC = fs.readFileSync(path.resolve(__dirname, "services/pdfReports.ts"), "utf8").replace(/\r\n/g, "\n");
const START = SRC.indexOf("export async function generateCustomerPDF");
const END = SRC.indexOf("\nexport ", START + 10);
const BODY = SRC.slice(START, END);

const day = (d: number) => new Date(2026, 8, d);
const sample = (fullName: string) => ({
  customer: { id: 1, fullName, customerCode: "AZ000", mobileNumber: "0750 000 0000", email: null, createdAt: day(1) },
  accountSummary: { totalCharges: 120, totalPayments: 100, currentBalance: 20, creditLimit: 0 },
  packages: [{ trackingNumber: "YT7524601234567", status: "in_transit", weightKg: 2.5, costUsd: 17.5, createdAt: day(2), batchCode: "AIR-012" }],
  payments: [{ amount: 100, method: "cash", reference: "حەواڵەی هەولێر", createdAt: day(5) }],
  transactions: [
    { type: "DEBIT_SHIPPING", amount: 120, description: "کرێی گواستنەوەی باچی AIR-012", createdAt: day(2), balanceAfter: 120 },
    { type: "CREDIT_PAYMENT", amount: 100, description: "پارەدان بە کاش", createdAt: day(5), balanceAfter: 20 },
  ],
  generatedAt: day(10),
  dateRange: { start: day(1), end: day(10) },
});

describe("the statement's first page", () => {
  it("found the function it checks", () => {
    expect(START).toBeGreaterThan(-1);
    expect(END).toBeGreaterThan(START);
  });

  it("has no navy block and says each total once", () => {
    expect(BODY).not.toContain("doc.rect(0, 0, 595, 100)");
    expect(BODY).not.toContain("L('balanceDue')");
    expect(BODY.split("L('currentBalance')").length - 1).toBe(1);
    expect(BODY.split("L('totalPayments')").length - 1).toBe(1);
  });

  it("sets every label and every data string through the right-to-left typesetter", () => {
    expect(BODY).not.toMatch(/\.text\(L\(/);
    expect(BODY).not.toMatch(/\.text\(statusText\(/);
    expect(BODY).not.toMatch(/\.text\(desc,/);
    expect(BODY).not.toMatch(/\.text\(data\.customer\.fullName/);
  });

  it("prints Kurdish data in a font that has the letters, in every language", () => {
    expect(BODY).toContain("hasVazir && ARABIC_SCRIPT.test(desc) ? 'Vazir' : 'Helvetica'");
    expect(BODY).toContain("if (!hasVazir || !ARABIC_SCRIPT.test(text))");
  });

  it("fits a short statement on one sheet, in Kurdish and in English", async () => {
    for (const lang of ["ku", "en"] as const) {
      const pdf = (await generateCustomerPDF(sample("ئارام کەریم ئەحمەد") as never, lang)).toString("latin1");
      expect(pdf.startsWith("%PDF"), lang).toBe(true);
      expect(pdf, lang).toContain("/Subtype /Image");
      expect(pdf.match(/\/Type \/Page\b/g)?.length, lang).toBe(1);
    }
  });
});
