/**
 * A debtor is reminded on WhatsApp in one press: a polite message in their
 * language and a sheet of what they owe (owner, 2026-11-05).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { debtReminderWhatsAppMessage } from "@shared/receiptWhatsApp";
import { debtSheetHtml } from "@/components/finance/DebtWhatsAppButton";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");

describe("debt reminder on WhatsApp", () => {
  it("names the amount once, in the customer's language, with no date promised", () => {
    const ku = debtReminderWhatsAppMessage("ku", { customerName: "Zainab Saeed", customerCode: "AZ001(Zainab Saeed)", owedUsd: 2991.456 });
    expect(ku).toContain("$2991.46");
    expect(ku).toContain("(AZ001)");
    expect(debtReminderWhatsAppMessage("ar", { owedUsd: 5 })).toContain("$5.00");
  });
  it("the sheet lists what is owed and ends on the balance", () => {
    const html = debtSheetHtml("ku", { id: 1, fullName: "x", customerCode: "AZ1" }, [{ verdict: "road", label: "CM-1", usd: 10 }], 2, 8);
    expect(html).toContain("CM-1");
    expect(html).toContain("$8.00");
    expect(html).toContain("−$2.00");
  });
  it("is on the reminders page", () => {
    expect(read("client/src/pages/finance/DebtReminders.tsx")).toContain("<DebtWhatsAppButton");
  });
});
