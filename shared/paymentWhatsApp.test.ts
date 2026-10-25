import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { paymentWhatsAppMessage } from "./paymentWhatsApp";

const chewar = { name: "Chewar Kochar Karim", amountUsd: 249.24, settlementNumber: "RCP-20261004-0001", boxCode: "BOX-20260908-001", parcelCount: 2, balanceUsd: 0 };

describe("“your payment arrived” on WhatsApp (owner, 2026-10-04)", () => {
  it("greets by name, gives the receipt and the account, and thanks", () => {
    const m = paymentWhatsAppMessage("ku", chewar);
    expect(m.startsWith("سڵاو بەڕێز Chewar Kochar Karim")).toBe(true);
    expect(m).toContain("$249.24");
    expect(m).toContain("RCP-20261004-0001");
    expect(m).toContain("حیسابەکەت ئێستا: $0.00");
    expect(m.trim().split("\n").at(-1)).toContain("سوپاس");
  });

  it("says what is still owed, and never the banned words", () => {
    const m = paymentWhatsAppMessage("ku", { ...chewar, balanceUsd: 85 });
    expect(m).toContain("ماوەی حیسابەکەت: *$85.00*");
    for (const word of ["ڕەسید", "ساڵب"]) expect(m).not.toContain(word);
  });

  it("Arabic and English customers are written to in their language", () => {
    expect(paymentWhatsAppMessage("ar", chewar)).toContain("وصلت دفعتك");
    expect(paymentWhatsAppMessage("en", chewar)).toContain("Your payment arrived");
  });

  // Since 2026-10-25 it is a button in the box, never a prompt after paying.
  it("the box offers it; the receipt screens do not prompt", () => {
    for (const f of ["QuickSettleDialog.tsx", "BoxSettlementPanel.tsx"]) {
      const src = fs.readFileSync(path.resolve(__dirname, "..", "client/src/components/delivery", f), "utf8");
      expect(src, f).not.toContain("offerPaymentWhatsApp(res.whatsapp,");
    }
    const box = fs.readFileSync(path.resolve(__dirname, "..", "client/src/components/delivery/BoxDetailPanel.tsx"), "utf8");
    expect(box).toContain('data-testid="box-payment-whatsapp"');
  });
});
