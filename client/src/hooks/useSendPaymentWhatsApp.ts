import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { paymentWhatsAppMessage } from "@shared/paymentWhatsApp";
import { receiptLanguageFor, whatsappChatUrl, whatsappNumber } from "@shared/receiptWhatsApp";

type Say = (w: { ku: string; en: string; ar: string; zh: string }) => string;

/**
 * Send "your payment arrived" for any receipt, later than the till: the facts
 * as the account stands now, the customer's chat opened, the receipt marked
 * sent (owner, 2026-10-04 — the bell's "not sent on WhatsApp" line and the
 * box's own receipts list both use it).
 */
export function useSendPaymentWhatsApp(say: Say, onDone?: () => void) {
  const utils = trpc.useUtils();
  const mark = trpc.deliveryBox.markPaymentWhatsAppSent.useMutation({
    onSuccess: () => {
      void utils.deliveryBox.unsentPaymentWhatsApp.invalidate();
      void utils.deliveryBox.settlementView.invalidate();
      void utils.dashboard.risks.invalidate();
      onDone?.();
    },
  });
  const send = async (settlementId: number) => {
    // Opened at the press itself — a window opened after waiting for the
    // server is blocked by the browser — and pointed at the chat once the
    // message is known.
    const win = window.open("about:blank", "_blank");
    const facts = await utils.deliveryBox.paymentWhatsAppFacts.fetch({ settlementId }).catch(() => null);
    if (!facts) {
      win?.close();
      toast.error(say({ ku: "ئەم وەسڵە نەدۆزرایەوە یان هەڵوەشێنراوەتەوە", en: "Receipt not found or reversed", ar: "الإيصال غير موجود أو ملغى", zh: "收据不存在或已撤销" }));
      return;
    }
    const number = whatsappNumber(facts.whatsapp.mobile);
    if (!number) {
      win?.close();
      toast.info(say({ ku: "ژمارەی مۆبایلی کڕیار نییە", en: "No mobile number for this customer", ar: "لا يوجد رقم جوال للعميل", zh: "客户没有手机号" }));
      return;
    }
    const message = paymentWhatsAppMessage(receiptLanguageFor(facts.whatsapp.nationality), {
      name: facts.whatsapp.name,
      amountUsd: facts.paidUsd,
      settlementNumber: facts.settlementNumber,
      boxCode: facts.whatsapp.boxCode,
      parcelCount: facts.whatsapp.parcelCount,
      balanceUsd: facts.whatsapp.balanceUsd,
    });
    const url = whatsappChatUrl(number, message);
    if (win) win.location.href = url;
    else window.open(url, "_blank", "noopener");
    mark.mutate({ settlementId });
  };
  /** The chat was opened elsewhere (the till's own button): just mark it. */
  const markSent = (settlementId: number) => mark.mutate({ settlementId });
  return { send, markSent };
}
