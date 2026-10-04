import { toast } from "sonner";
import { paymentWhatsAppMessage } from "@shared/paymentWhatsApp";
import { receiptLanguageFor, whatsappChatUrl, whatsappNumber } from "@shared/receiptWhatsApp";

export interface PaymentWhatsAppFacts {
  name: string;
  mobile: string | null;
  nationality: string | null;
  balanceUsd: number;
  boxCode: string;
  parcelCount: number;
}

/**
 * Right after a receipt: one tap opens the customer's WhatsApp chat with
 * "your payment arrived" and the account's status typed in (owner,
 * 2026-10-04). The office's WhatsApp sends it; nothing leaves on its own.
 */
export function offerPaymentWhatsApp(
  facts: PaymentWhatsAppFacts | null | undefined,
  receipt: { settlementNumber: string; paidUsd: number },
  say: (w: { ku: string; en: string; ar: string; zh: string }) => string,
): void {
  if (!facts || !(receipt.paidUsd > 0)) return;
  const number = whatsappNumber(facts.mobile);
  if (!number) {
    toast.info(say({
      ku: "ژمارەی مۆبایلی کڕیار نییە — نامەی واتسئەپ ناتوانرێت بنێردرێت",
      en: "No mobile number for this customer — the WhatsApp message cannot be sent",
      ar: "لا يوجد رقم جوال للعميل — لا يمكن إرسال رسالة واتساب",
      zh: "客户没有手机号 — 无法发送 WhatsApp",
    }));
    return;
  }
  const message = paymentWhatsAppMessage(receiptLanguageFor(facts.nationality), {
    name: facts.name,
    amountUsd: receipt.paidUsd,
    settlementNumber: receipt.settlementNumber,
    boxCode: facts.boxCode,
    parcelCount: facts.parcelCount,
    balanceUsd: facts.balanceUsd,
  });
  toast.success(say({ ku: "نامەی «پارەکەت گەیشت» ئامادەیە", en: "\"Payment arrived\" message ready", ar: "رسالة «وصلت دفعتك» جاهزة", zh: "“已收款”消息已就绪" }), {
    description: `${facts.name} · ${facts.boxCode}`,
    duration: 60_000,
    action: {
      label: say({ ku: "📲 ناردن بۆ واتسئەپ", en: "📲 Send on WhatsApp", ar: "📲 إرسال واتساب", zh: "📲 发送 WhatsApp" }),
      onClick: () => window.open(whatsappChatUrl(number, message), "_blank", "noopener"),
    },
  });
}
