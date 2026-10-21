import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { payeeCodeMatches, payeeDigits } from "./payeeCheck";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/** Owner, 2026-10-21: one customer's money must never land on another's box. */
describe("whose money is this", () => {
  it("reads the digits of a code", () => {
    expect(payeeDigits("AZ303")).toBe("303");
    expect(payeeDigits("AZ303(Sayf Shakhi)")).toBe("303");
    expect(payeeDigits("AZ001")).toBe("001");
    expect(payeeDigits("")).toBe("");
  });

  it("the same digits, leading zeros aside; nothing typed is no", () => {
    expect(payeeCodeMatches("AZ303", "303")).toBe(true);
    expect(payeeCodeMatches("AZ303", "AZ303")).toBe(true);
    expect(payeeCodeMatches("AZ001", "1")).toBe(true);
    expect(payeeCodeMatches("AZ303", "302")).toBe(false);
    expect(payeeCodeMatches("AZ303", "")).toBe(false);
    expect(payeeCodeMatches("AZ303", undefined)).toBe(false);
  });

  it("a customer whose code carries no digits is not held up", () => {
    expect(payeeCodeMatches("VIP", "")).toBe(true);
  });

  it("the server refuses a payment without it, and both payment screens ask it", () => {
    const router = read("server/routers/scanning.router.ts");
    expect(router).toContain("if (payee && !payeeCodeMatches(payee.customerCode, confirmCustomerCode)) {");
    const quick = read("client/src/components/delivery/QuickSettleDialog.tsx");
    expect(quick).toContain("<PayeeConfirm");
    expect(quick).toContain("confirmCustomerCode: payeeCode,");
    expect(quick).toContain("disabled={needsReason || settle.isPending || !payeeOk}");
    const panel = read("client/src/components/delivery/BoxSettlementPanel.tsx");
    expect(panel).toContain("      confirmCustomerCode,\n");
    expect(panel).toContain("payeeOk === false");
  });

  it("the name and code flash, and the button names whose money", () => {
    const banner = read("client/src/components/delivery/PayeeConfirm.tsx");
    expect(banner.split("motion-safe:animate-pulse").length - 1).toBe(2);
    expect(banner).toContain("ku: `وەرگرتنی ${amount} لە ${who}`");
  });
});
