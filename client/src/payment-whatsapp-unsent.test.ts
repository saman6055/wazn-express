import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildRiskItems, describeRisk, riskGroup, RISK_PATH, type RiskFacts } from "@shared/riskBell";

const NONE: RiskFacts = { staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0, emptyBoxes: 0 };
import { paymentWhatsAppMessage } from "@shared/paymentWhatsApp";

/**
 * A receipt whose "your payment arrived" was not sent on WhatsApp shows in the
 * bell, and the bell leads to a list where one tap sends it (owner,
 * 2026-10-04). The portal notice goes out at the receipt either way.
 *
 * What would undo it: the till's Send no longer marking the receipt, the bell
 * line pointing nowhere, the list not mounted, or the portal notice being tied
 * to WhatsApp.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");
const readRoot = (p: string) => fs.readFileSync(path.resolve(SRC, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("the bell counts unsent receipts", () => {
  it("as an incomplete-work notice that opens the list", () => {
    const items = buildRiskItems({ ...NONE, whatsappUnsent: 3 });
    const item = items.find((i) => i.id === "whatsapp-unsent");
    expect(item?.count).toBe(3);
    expect(riskGroup("whatsapp-unsent")).toBe("incomplete");
    expect(RISK_PATH["whatsapp-unsent"]).toBe("/customer-delivery-scanner?whatsapp=unsent");
    expect(describeRisk(item!).title.ku).toContain("3 وەسڵ");
  });

  it("and says nothing when every receipt was sent", () => {
    const items = buildRiskItems({ ...NONE, whatsappUnsent: 0 });
    expect(items.some((i) => i.id === "whatsapp-unsent")).toBe(false);
  });

  it("counted by the server from the same list the screen shows", () => {
    const reports = readRoot("server/db/reports.db.ts");
    expect(reports).toContain("listUnsentPaymentWhatsApp()");
    expect(reports).toContain("whatsappUnsent");
  });
});

describe("the list behind the bell", () => {
  const page = read("pages/CustomerDeliveryScanner.tsx");
  const alert = read("components/delivery/UnsentPaymentWhatsApp.tsx");

  it("is mounted on the boxes page and opens itself from the bell", () => {
    expect(page).toContain("<UnsentPaymentWhatsAppAlert />");
    expect(alert).toContain('get("whatsapp") === "unsent"');
    expect(alert).toContain("unsentPaymentWhatsApp.useQuery");
  });

  it("sends with one tap, and links to the box", () => {
    expect(alert).toContain("wa.send(r.settlementId)");
    expect(alert).toContain("/customer-delivery-scanner?box=${r.boxId}");
  });
});

describe("sending marks the receipt", () => {
  const hook = read("hooks/useSendPaymentWhatsApp.ts");

  it("from the list and from the till's own toast", () => {
    expect(hook).toContain("markPaymentWhatsAppSent.useMutation");
    expect(hook).toContain("unsentPaymentWhatsApp.invalidate()");
    expect(hook).toContain("dashboard.risks.invalidate()");
    for (const f of ["components/delivery/QuickSettleDialog.tsx", "components/delivery/BoxSettlementPanel.tsx"]) {
      expect(read(f), f).toContain("paymentWhatsApp.markSent(res.settlementId)");
    }
  });

  it("only receipts since the start, confirmed and paid, after a short grace", () => {
    const db = readRoot("server/db/paymentWhatsApp.db.ts");
    const list = db.slice(db.indexOf("export async function listUnsentPaymentWhatsApp"));
    expect(list.length).toBeGreaterThan(100);
    for (const piece of ['eq(boxSettlements.status, "confirmed")', "isNull(boxSettlements.whatsappSentAt)", "PAYMENT_WHATSAPP_SINCE", "PAYMENT_WHATSAPP_GRACE_MS"]) {
      expect(list).toContain(piece);
    }
  });
});

describe("the portal is told regardless of WhatsApp", () => {
  it("the receipt itself writes the portal notice", () => {
    const settle = readRoot("server/db/boxSettlement.db.ts");
    expect(settle).toContain("createCustomerNotification");
  });
});

describe("the message", () => {
  it("greets by name and thanks at the end", () => {
    const msg = paymentWhatsAppMessage("ku", { name: "چێوار", amountUsd: 249.24, settlementNumber: "RCP-1", boxCode: "B1", parcelCount: 2, balanceUsd: 0 });
    expect(msg.startsWith("سڵاو بەڕێز چێوار")).toBe(true);
    expect(msg.trim().split("\n").pop()).toContain("سوپاس");
  });
});
