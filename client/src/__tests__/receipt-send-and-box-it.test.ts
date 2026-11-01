import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-21: send from the window before printing, with the same
 * discount, rate and advance as the paper; and «بۆکس دروست بکە بۆی» on Quick
 * Register, straight into the customer's open box or a new one made the way
 * the last went.
 */
describe("the window before printing also sends", () => {
  const dialog = read("client/src/components/delivery/ReceiptDinarDialog.tsx");
  const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");

  it("one check, then print or send with the same figures", () => {
    expect(dialog).toContain("const finish = async (then: (dinar: ReceiptDinarInput | null, given: ReceiptDiscount | null) => void) => {");
    expect(dialog).toContain("void finish((dinar, given) => send.onSend(dinar, given, format, destination, sendLang));");
    expect(dialog).toContain('data-testid="receipt-dinar-send"');
    expect(dialog).toContain("<ReceiptSendMenu");
  });

  it("the box gives it the send, through the same pledge and share as the box's own button", () => {
    expect(panel).toContain('send: action === "print"');
    expect(panel).toContain("void printWithPledge(sendLang as Language, dinar, given, (l, d, g) => shareReceiptNow(l, d, g, format, destination, sendLang));");
    expect(panel).toContain("customerName: customer?.fullName ?? null,");
  });
});

describe("«بۆکس دروست بکە بۆی» on Quick Register", () => {
  const db = read("server/db/boxHandover.db.ts");
  const button = read("client/src/components/delivery/BoxForParcel.tsx");
  const page = read("client/src/pages/QuickRegister.tsx");

  it("an open box is one with no receipt printed or sent, not paid, still taking parcels", () => {
    const fn = db.slice(db.indexOf("export async function boxChoiceForCustomer"));
    expect(fn).toContain("db.selectDistinct({ boxId: boxReceiptEvents.boxId })");
    expect(fn).toContain('b.status === "open" && !paid.has(Number(b.id)) && !papered.has(Number(b.id)),');
  });

  it("a new box goes the way the last one did, and the parcel is put in, then the box opens", () => {
    expect(button).toContain("handover: last.handoverMode");
    expect(button).toContain("deliveryChargeUsd: last?.deliveryChargeUsd ?? \"0\",");
    expect(button).toContain("await addItem.mutateAsync({ boxId, trackingNumber });");
    expect(button).toContain("setLocation(`/customer-delivery-scanner?box=${boxId}`);");
    expect(button).toContain('if ((e.key === "ArrowUp" || e.key === "ArrowDown") && data.open) {');
  });

  it("the strip keeps the customer on every path, so the button is always there", () => {
    expect(page).toContain("customerId: myLastRegistration.isUnclaimed ? null : (myLastRegistration.customerId ?? null),");
    expect(page).toContain("customerId: isUnclaimed ? null : (customerId ?? null),");
    expect(page).toContain("customerId: last.isUnclaimed ? null : (last.customerId ?? null),");
    expect(page).toContain("<BoxForParcel");
  });
});
