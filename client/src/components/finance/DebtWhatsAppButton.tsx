import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { shareReceiptOnWhatsApp } from "@/lib/receiptShare";
import { debtReminderWhatsAppMessage, receiptLanguageFor, whatsappChatUrl, whatsappNumber, type ReceiptLanguage } from "@shared/receiptWhatsApp";

/**
 * One press: the customer's chat opens with a polite reminder in their own
 * language, and a one-page sheet of what they owe goes with it (owner,
 * 2026-11-05). The office's WhatsApp sends it, as with box receipts
 * (lib/receiptShare): on the computer the sheet is on the clipboard - Ctrl+V,
 * Enter; on a phone the share sheet carries it.
 */
type Customer = { id: number; fullName?: string | null; customerCode?: string | null; mobileNumber?: string | null; nationality?: string | null };

const WORDS: Record<ReceiptLanguage, { title: string; date: string; item: string; place: string; usd: string; total: string; advance: string; kinds: Record<string, string> }> = {
  ku: { title: "لیستی قەرز", date: "ڕێکەوت", item: "داواکاری / تراکینگ", place: "کوێیە", usd: "دۆلار", total: "کۆی ماوە", advance: "پێشەکی", kinds: { road: "لە ڕێگایە", arrived: "گەیشتووە", openBox: "لە بۆکسدایە", parcel: "پاکەت" } },
  ar: { title: "كشف المبلغ المتبقي", date: "التاريخ", item: "الطلب / التتبع", place: "الحالة", usd: "دولار", total: "المجموع المتبقي", advance: "دفعة مقدمة", kinds: { road: "في الطريق", arrived: "وصل", openBox: "في الصندوق", parcel: "طرد" } },
  en: { title: "Balance statement", date: "Date", item: "Order / tracking", place: "Where", usd: "USD", total: "Balance due", advance: "Advance", kinds: { road: "On the road", arrived: "Arrived", openBox: "In a box", parcel: "Parcel" } },
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function debtSheetHtml(lang: ReceiptLanguage, customer: Customer, items: Array<{ verdict: string; label: string; boxCode?: string | null; usd: number }>, advanceUsd: number, balanceUsd: number): string {
  const w = WORDS[lang];
  const dir = lang === "en" ? "ltr" : "rtl";
  const rows = items.map((i) => `<tr><td>${esc(i.label)}</td><td>${esc(i.boxCode || w.kinds[i.verdict] || "")}</td><td class="n">$${i.usd.toFixed(2)}</td></tr>`).join("");
  const adv = advanceUsd > 0.005 ? `<tr><td colspan="2">${w.advance}</td><td class="n">−$${advanceUsd.toFixed(2)}</td></tr>` : "";
  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><style>
body{font-family:"Noto Sans Arabic",Tahoma,sans-serif;margin:0;padding:28px 32px;color:#111;background:#fff;width:720px}
h1{font-size:20px;margin:0}.sub{color:#555;font-size:13px;margin:4px 0 16px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid #ddd;padding:6px 4px;text-align:start}th{color:#555;font-weight:600}
.n{text-align:left;direction:ltr;white-space:nowrap}.t td{font-weight:700;border-top:2px solid #111;border-bottom:0;font-size:15px}
.brand{color:#0e7490;font-weight:800;font-size:18px}</style></head><body>
<div class="brand">Wazn Express · وەزن ئێکسپرێس</div>
<h1>${w.title}</h1>
<div class="sub">${esc(customer.fullName)} · ${esc(String(customer.customerCode ?? "").replace(/\(.*/, ""))} · ${w.date}: ${new Date().toLocaleDateString("en-GB")}</div>
<table><thead><tr><th>${w.item}</th><th>${w.place}</th><th class="n">${w.usd}</th></tr></thead><tbody>${rows}${adv}
<tr class="t"><td colspan="2">${w.total}</td><td class="n">$${balanceUsd.toFixed(2)}</td></tr></tbody></table>
</body></html>`;
}

export function DebtWhatsAppButton({ customer, owedUsd, size = "sm" }: { customer: Customer; owedUsd: number; size?: "sm" | "icon" }) {
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);
  const number = whatsappNumber(customer.mobileNumber);
  if (!(owedUsd > 0.005)) return null;

  const go = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const lang = receiptLanguageFor(customer.nationality);
      const ex = await utils.ledger.debtExplained.fetch({ customerId: customer.id });
      const items = (ex?.items ?? []).map((i: any) => ({
        verdict: String(i.verdict ?? ""),
        label: [i.orderCode, i.productName, i.tracking].filter(Boolean).join(" · ") || String(i.key ?? ""),
        boxCode: i.boxCode ?? null,
        usd: Number(i.usd ?? 0),
      })).filter((i) => i.usd > 0.005);
      const advanceUsd = Number(ex?.advance?.leftUsd ?? 0);
      const balanceUsd = Number(ex?.balanceUsd ?? owedUsd);
      const message = debtReminderWhatsAppMessage(lang, { customerName: customer.fullName, customerCode: customer.customerCode, owedUsd: balanceUsd });
      const outcome = await shareReceiptOnWhatsApp({
        html: debtSheetHtml(lang, customer, items, advanceUsd, balanceUsd),
        format: "image",
        fileName: `qarz-${String(customer.customerCode ?? customer.id).replace(/\(.*/, "").trim()}`,
        message,
        chatUrl: number ? whatsappChatUrl(number, message) : null,
      });
      if (outcome === "copied") toast.success(pickLang(language, { ku: "وێنەکە کۆپی کرا — لە واتسئەپ Ctrl+V و Enter", en: "Copied — in WhatsApp press Ctrl+V, Enter", ar: "تم النسخ — في واتساب Ctrl+V ثم Enter", zh: "已复制 — 在 WhatsApp 中 Ctrl+V 后回车" }));
      else if (outcome === "failed") toast.error(pickLang(language, { ku: "پەڕەکە دروست نەبوو", en: "The sheet could not be made", ar: "تعذر إنشاء الكشف", zh: "无法生成清单" }));
      else if (!number) toast.message(pickLang(language, { ku: "ژمارەی مۆبایل نییە — پەڕەکە پاشەکەوت کرا", en: "No mobile number — the sheet was saved", ar: "لا يوجد رقم — تم حفظ الكشف", zh: "无手机号 — 已保存清单" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={go} disabled={busy}
      className="h-8 gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/40"
      data-testid="debt-whatsapp">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
      {size === "sm" && pickLang(language, { ku: "واتسئەپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" })}
    </Button>
  );
}
