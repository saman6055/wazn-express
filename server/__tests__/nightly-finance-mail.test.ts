/** Point 41.4: the books leave the server every night (owner, 2026-11-06). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
describe("nightly finance mail", () => {
  it("is scheduled at midnight Baghdad and started with the server", () => {
    expect(read("server/services/financeNightlyMail.service.ts")).toContain('schedule("0 0 * * *", () => { void sendNightlyFinanceMail(); }, { timezone: "Asia/Baghdad" });');
    expect(read("server/_core/index.ts")).toContain("startNightlyFinanceMail();");
  });
  it("is the main admin's to set, and shown on working capital", () => {
    const r = read("server/routers/finance.router.ts");
    expect(r).toContain("setNightlyMail: superAdminProcedure");
    expect(r).toContain("sendNightlyMailNow: superAdminProcedure");
    expect(read("client/src/pages/finance/WorkingCapital.tsx")).toContain("<NightlyMailCard />");
  });
});
