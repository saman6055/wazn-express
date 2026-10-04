import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { MessageCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useSendPaymentWhatsApp } from "@/hooks/useSendPaymentWhatsApp";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * Receipts whose "your payment arrived" was not sent on WhatsApp yet (owner,
 * 2026-10-04: "if the WhatsApp notice did not go, show it in the bell too,
 * with a link there, so the job gets done"). The portal was told at once
 * either way. Opens by itself when arriving from the bell (?whatsapp=unsent).
 */
export function UnsentPaymentWhatsAppAlert() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const search = useSearch();
  const { data } = trpc.deliveryBox.unsentPaymentWhatsApp.useQuery(undefined, { staleTime: 30_000 });
  const rows = data ?? [];
  const wa = useSendPaymentWhatsApp(L);
  const fromBell = new URLSearchParams(search).get("whatsapp") === "unsent";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (fromBell && rows.length > 0) setOpen(true);
  }, [fromBell, rows.length]);

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="unsent-whatsapp">
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircle className="h-4 w-4 shrink-0" />
        <span>
          {L({
            ku: `${rows.length} وەسڵ هێشتا بە واتسئەپ نەنێردراوە — کڕیار ئاگادار نەکراوەتەوە کە پارەکەی گەیشت.`,
            en: `${rows.length} receipt(s) not sent on WhatsApp — the customer was not told the payment arrived.`,
            ar: `${rows.length} إيصال لم يُرسل عبر واتساب.`,
            zh: `${rows.length} 张收据未通过 WhatsApp 发送。`,
          })}
        </span>
        <Button variant="outline" size="sm" className="ms-auto h-7" onClick={() => setOpen((o) => !o)}>
          {open ? L({ ku: "داخستن", en: "Hide", ar: "إخفاء", zh: "收起" }) : L({ ku: "بیانبینە", en: "Show", ar: "اعرض", zh: "查看" })}
        </Button>
      </div>
      {open && (
        <ul className="mt-2 divide-y rounded-md border bg-background text-foreground">
          {rows.map((r) => (
            <li key={r.settlementId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.customerName ?? r.customerCode}</span>
                <span className="block text-xs text-muted-foreground">
                  <bdi dir="ltr">{r.settlementNumber}</bdi> · <bdi dir="ltr">{r.boxCode}</bdi> · <bdi dir="ltr">{fmtUsd(Number(r.paidUsd))}</bdi>
                </span>
              </span>
              <Link href={`/customer-delivery-scanner?box=${r.boxId}`} className="text-xs underline">
                {L({ ku: "بۆکس", en: "Box", ar: "الصندوق", zh: "箱子" })}
              </Link>
              <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void wa.send(r.settlementId)}>
                📲 {L({ ku: "ناردن", en: "Send", ar: "إرسال", zh: "发送" })}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
