import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { REMIND_AFTER_DAYS } from "@shared/boxReminder";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * Boxes handed over three days ago with money still owed — put in front of
 * the office before anything is said to the customer (owner, 2026-10-07:
 * "sometimes the money was paid and the admin was slow to receipt it").
 *
 * Two answers per box: receipt it, or "no, it has not been paid". Only the
 * second sends the customer the gentle reminder (shared/boxReminder). Opens
 * by itself when arriving from the bell (?unpaid=1).
 */
export function UnpaidBoxesAlert() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const search = useSearch();
  const utils = trpc.useUtils();
  const { data } = trpc.deliveryBox.awaitingPayment.useQuery(undefined, { staleTime: 60_000 });
  const rows = data ?? [];
  const due = rows.filter((r) => r.due);
  const fromBell = new URLSearchParams(search).get("unpaid") === "1";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (fromBell && rows.length > 0) setOpen(true);
  }, [fromBell, rows.length]);

  const confirm = trpc.deliveryBox.confirmUnpaid.useMutation({
    onSuccess: () => {
      void utils.deliveryBox.awaitingPayment.invalidate();
      void utils.dashboard.risks.invalidate();
      toast.success(L({ ku: "کڕیار بە نەرمی وەبیر هێنرایەوە", en: "The customer was gently reminded", ar: "تم تذكير العميل بلطف", zh: "已温和提醒客户" }));
    },
    onError: (e) => toast.error(e.message),
  });

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="unpaid-boxes">
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          {due.length > 0
            ? L({
                ku: `${due.length} بۆکس دراوەتە دەست و پارەی نەهاتووە — دڵنیا بکەوە.`,
                en: `${due.length} box(es) handed over and not paid — please confirm.`,
                ar: `${due.length} صندوق سُلِّم ولم يُدفع — يرجى التأكد.`,
                zh: `${due.length} 个箱子已交付未付款 — 请确认。`,
              })
            : L({
                ku: `${rows.length} بۆکس پارەی ماوە — کڕیارەکانیان وەبیر هێنراونەتەوە.`,
                en: `${rows.length} box(es) still owed — their customers have been reminded.`,
                ar: `${rows.length} صندوق لم يُسدَّد — تم تذكير العملاء.`,
                zh: `${rows.length} 个箱子未付清 — 已提醒客户。`,
              })}
        </span>
        <Button variant="outline" size="sm" className="ms-auto h-7" onClick={() => setOpen((o) => !o)}>
          {open ? L({ ku: "داخستن", en: "Hide", ar: "إخفاء", zh: "收起" }) : L({ ku: "بیانبینە", en: "Show", ar: "اعرض", zh: "查看" })}
        </Button>
      </div>
      {open && (
        <ul className="mt-2 divide-y rounded-md border bg-background text-foreground">
          {rows.map((r) => (
            <li key={r.boxId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.customerName ?? r.customerCode}</span>
                <span className="block text-xs text-muted-foreground">
                  <bdi dir="ltr">{r.boxCode}</bdi> · <bdi dir="ltr">{fmtUsd(r.outstandingUsd)}</bdi> ·{" "}
                  {L({ ku: `${r.daysHanded} ڕۆژە دراوەتە دەست`, en: `handed over ${r.daysHanded} days ago`, ar: `سُلِّم منذ ${r.daysHanded} يوماً`, zh: `${r.daysHanded} 天前交付` })}
                  {r.reminderCount > 0 && (
                    <> · {L({ ku: `${r.reminderCount} جار وەبیر هێنراوەتەوە`, en: `reminded ${r.reminderCount}×`, ar: `ذُكِّر ${r.reminderCount} مرة`, zh: `已提醒 ${r.reminderCount} 次` })}</>
                  )}
                </span>
              </span>
              <Link href={`/customer-delivery-scanner?box=${r.boxId}`}>
                <Button size="sm" variant="outline" className="h-8">
                  {L({ ku: "واسڵی بکە", en: "Receipt it", ar: "أصدر الإيصال", zh: "开收据" })}
                </Button>
              </Link>
              {r.due ? (
                <Button size="sm" className="h-8" disabled={confirm.isPending} onClick={() => confirm.mutate({ boxId: r.boxId })}>
                  {L({ ku: "بەڵێ، نەیداوە — وەبیری بهێنەوە", en: "Not paid — remind gently", ar: "لم يدفع — ذكّره بلطف", zh: "未付 — 温和提醒" })}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {L({ ku: `دووبارە دوای ${REMIND_AFTER_DAYS} ڕۆژ دەپرسرێتەوە`, en: `asked again after ${REMIND_AFTER_DAYS} days`, ar: `يُسأل مجدداً بعد ${REMIND_AFTER_DAYS} أيام`, zh: `${REMIND_AFTER_DAYS} 天后再问` })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
