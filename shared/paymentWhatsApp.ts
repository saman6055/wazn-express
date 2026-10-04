/**
 * "Your payment arrived" on WhatsApp, right after a box is receipted (owner,
 * 2026-10-04: "after the payment is receipted, write it in WhatsApp — the
 * payment and the account's status — the way we did before"; and "start with
 * 'سڵاو بەڕێز' and the name, and end with a thank-you").
 *
 * Every figure comes from the receipt and the account as they stand after it;
 * nothing is typed. The language follows the customer's nationality, the same
 * rule as the receipt (shared/receiptWhatsApp). Nothing here sends anything:
 * the office's WhatsApp opens the customer's chat with this typed in.
 */

import type { ReceiptLanguage } from "./receiptWhatsApp";

export interface PaymentMessageFacts {
  name: string;
  amountUsd: number;
  settlementNumber: string;
  boxCode: string;
  parcelCount: number;
  /** The account after this receipt. Positive is still owed. */
  balanceUsd: number;
}

export const PORTAL_ADDRESS = "waznexpress.com/portal";

/** Receipts from this moment on are expected to be sent (earlier ones never were). */
export const PAYMENT_WHATSAPP_SINCE = new Date("2026-10-04T17:00:00Z");

const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function paymentWhatsAppMessage(lang: ReceiptLanguage, f: PaymentMessageFacts): string {
  const owes = Math.round(f.balanceUsd * 100) / 100;
  const parcels = Math.max(0, Math.round(f.parcelCount || 0));
  const name = f.name.trim();

  if (lang === "ar") {
    const status = owes > 0.005
      ? `📊 المتبقي على حسابك: *${money(owes)}*`
      : owes < -0.005
        ? `📊 لك عندنا: *${money(-owes)}* — يُخصم من شحنتك القادمة`
        : `📊 *حسابك الآن: $0.00* — لا يوجد عليك أي دين 🎉`;
    return [
      `مرحباً السيد/ة ${name} 👋`,
      ``,
      `✅ *وصلت دفعتك*`,
      `المبلغ: *${money(f.amountUsd)}*`,
      `الإيصال: ${f.settlementNumber}`,
      `الصندوق: ${f.boxCode} (${parcels} طرد)`,
      ``,
      status,
      ``,
      `التفاصيل في بوابتك: ${PORTAL_ADDRESS}`,
      `شكراً جزيلاً لثقتكم 🙏 — وزن اكسبريس`,
    ].join("\n");
  }
  if (lang === "en") {
    const status = owes > 0.005
      ? `📊 Still on your account: *${money(owes)}*`
      : owes < -0.005
        ? `📊 We hold *${money(-owes)}* of yours — taken off your next shipment`
        : `📊 *Your account now: $0.00* — nothing owed 🎉`;
    return [
      `Hello dear ${name} 👋`,
      ``,
      `✅ *Your payment arrived*`,
      `Amount: *${money(f.amountUsd)}*`,
      `Receipt: ${f.settlementNumber}`,
      `Box: ${f.boxCode} (${parcels} parcel${parcels === 1 ? "" : "s"})`,
      ``,
      status,
      ``,
      `Details in your portal: ${PORTAL_ADDRESS}`,
      `Thank you very much for your trust 🙏 — Wazn Express`,
    ].join("\n");
  }
  // The portal's own words for a balance (client/src/lib/portalMoney) —
  // never ڕەسید or ساڵب to a customer.
  const status = owes > 0.005
    ? `📊 ماوەی حیسابەکەت: *${money(owes)}*`
    : owes < -0.005
      ? `📊 *${money(-owes)}* پارەت لای ئێمەیە — لە پاکەتی داهاتووت کەم دەکرێتەوە`
      : `📊 *حیسابەکەت ئێستا: $0.00* — هیچ قەرزێکت نەماوە 🎉`;
  return [
    `سڵاو بەڕێز ${name} 👋`,
    ``,
    `✅ *پارەکەت گەیشت*`,
    `بڕ: *${money(f.amountUsd)}*`,
    `وەسڵ: ${f.settlementNumber}`,
    `بۆکس: ${f.boxCode} (${parcels} پاکەت)`,
    ``,
    status,
    ``,
    `وردەکاری لە پۆرتاڵەکەت: ${PORTAL_ADDRESS}`,
    `زۆر سوپاس بۆ متمانەت 🙏 — وەزن ئێکسپرێس`,
  ].join("\n");
}
