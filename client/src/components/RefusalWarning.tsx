import { Link } from "wouter";
import { Ban, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { CAUTIONS_BEFORE_BLOCK, STANDING_REASON_WORDS, type StandingReason } from "@shared/customerStanding";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * What the office should know before doing something for this customer
 * (owner, 2026-10-07): on the blacklist, and why; a caution on them; goods
 * refused before. Shown where their next order or parcel is typed — "if we
 * forget and they come back, the system knows them".
 *
 * `buying` is for screens that buy for the customer: the blacklist stops
 * those, and the line says so. Elsewhere it only warns.
 */
export function RefusalWarning({ customerId, buying = true }: { customerId: number | null | undefined; buying?: boolean }) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const id = Number(customerId) || 0;
  const { data } = trpc.ledger.customerStanding.useQuery({ customerId: id }, { enabled: id > 0, staleTime: 30_000 });
  if (!data || (data.standing === "ok" && data.refusals <= 0)) return null;

  const blocked = data.standing === "blocked";
  const reason = data.current?.reason ? L(STANDING_REASON_WORDS[data.current.reason as StandingReason]) : null;
  const said = [reason, data.current?.text].filter(Boolean).join(" — ");

  return (
    <div
      className={
        blocked
          ? "flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
          : "flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      }
      data-testid="refusal-warning"
      data-standing={data.standing}
    >
      {blocked ? <Ban className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="min-w-0 space-y-0.5">
        {blocked && (
          <span className="block font-semibold">
            {L({ ku: "ئەم کڕیارە لە لیستی ڕەشدایە", en: "This customer is blacklisted", ar: "هذا العميل في القائمة السوداء", zh: "该客户在黑名单中" })}
            {said ? `: ${said}` : ""}
            {buying && <> — {L({ ku: "داواکاریی نوێی بۆ هەڵناگیرێت", en: "a new order will not save", ar: "لن يُحفظ طلب جديد له", zh: "无法为其保存新订单" })}</>}
          </span>
        )}
        {data.standing === "caution" && (
          <span className="block font-semibold">
            {L({ ku: `ئاگاداری لەسەر ئەم کڕیارەیە (${data.cautions} تێبینی)`, en: `A caution on this customer (${data.cautions} note(s))`, ar: `تنبيه على هذا العميل (${data.cautions})`, zh: `该客户有提醒（${data.cautions} 条）` })}
            {said ? `: ${said}` : ""}
            {data.cautions >= CAUTIONS_BEFORE_BLOCK && <> — {L({ ku: "دووبارەی کردۆتەوە؛ بیر لە لیستی ڕەش بکەوە", en: "it has happened again; consider the blacklist", ar: "تكرر ذلك؛ فكّر في القائمة السوداء", zh: "已再次发生；可考虑拉黑" })}</>}
          </span>
        )}
        {data.refusals > 0 && (
          <span className="block">
            {L({ ku: `${data.refusals} جار کاڵای ڕەت کردۆتەوە. پێش داواکردن، پێشەکی پارەی لێ وەربگرە.`, en: `Refused goods ${data.refusals} time(s). Take money in advance before ordering.`, ar: `رفض البضاعة ${data.refusals} مرة. خذ دفعة مقدمة قبل الطلب.`, zh: `已拒收 ${data.refusals} 次。下单前请先收款。` })}
          </span>
        )}
        <Link href={`/customers/standing?customer=${id}`} className="block text-xs underline">
          {L({ ku: "مێژووەکەی ببینە", en: "See the history", ar: "اعرض السجل", zh: "查看记录" })}
        </Link>
      </span>
    </div>
  );
}
