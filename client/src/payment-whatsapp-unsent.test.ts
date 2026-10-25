import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { paymentWhatsAppMessage } from "@shared/paymentWhatsApp";

/**
 * «Your payment arrived» on WhatsApp is a choice, not a chore (owner,
 * 2026-10-25). Paying a box no longer pops a send prompt, the bell no longer
 * counts unsent receipts, and the boxes page no longer shows the unsent list.
 * Instead the box itself carries one button that sends it when the office
 * wants. The portal tells the customer at the receipt either way.
 *
 * Also here: only one box open at a time in the customer's boxes panel.
 *
 * What would undo it: the prompt coming back after paying, the bell item or
 * the list coming back, the box button going, or the portal notice being
 * tied to WhatsApp.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");
const readRoot = (p: string) => fs.readFileSync(path.resolve(SRC, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("paying a box does not ask to send WhatsApp", () => {
  it("no prompt from the till or the settlement panel", () => {
    for (const f of ["components/delivery/QuickSettleDialog.tsx", "components/delivery/BoxSettlementPanel.tsx"]) {
      expect(read(f), f).not.toContain("offerPaymentWhatsApp(");
    }
  });

  it("no unsent list on the boxes page, no bell count", () => {
    expect(read("pages/CustomerDeliveryScanner.tsx")).not.toContain("<UnsentPaymentWhatsAppAlert");
    const reports = readRoot("server/db/reports.db.ts");
    expect(reports).not.toContain("listUnsentPaymentWhatsApp()");
  });
});

describe("the box carries the choice", () => {
  const panel = read("components/delivery/BoxDetailPanel.tsx");

  it("one button sends «payment arrived» for the latest receipt and shows when sent", () => {
    expect(panel).toContain('data-testid="box-payment-whatsapp"');
    expect(panel).toContain("paymentWhatsApp.send(latestReceipt.id)");
    expect(panel).toContain("latestReceipt.whatsappSentAt");
  });

  it("sending still marks the receipt", () => {
    expect(read("hooks/useSendPaymentWhatsApp.ts")).toContain("markPaymentWhatsAppSent.useMutation");
  });
});

describe("the portal is told regardless of WhatsApp", () => {
  it("the receipt itself writes the portal notice", () => {
    expect(readRoot("server/db/boxSettlement.db.ts")).toContain("createCustomerNotification");
  });
});

describe("one box open at a time", () => {
  it("opening another box closes the last", () => {
    expect(read("components/delivery/CustomerBoxesPanel.tsx")).toContain("old.has(id) ? new Set() : new Set([id])");
  });
});

describe("the message", () => {
  it("greets by name and thanks at the end", () => {
    const msg = paymentWhatsAppMessage("ku", { name: "چێوار", amountUsd: 249.24, settlementNumber: "RCP-1", boxCode: "B1", parcelCount: 2, balanceUsd: 0 });
    expect(msg.startsWith("سڵاو بەڕێز چێوار")).toBe(true);
    expect(msg.trim().split("\n").pop()).toContain("سوپاس");
  });
});
