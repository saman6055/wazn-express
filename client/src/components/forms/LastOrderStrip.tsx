import { CheckCircle2, PencilLine } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { OrderNumbers } from "@/components/OrderNumbers";
import { isRecentEntry, lastOrderEditHref, type EntryOrderType } from "@shared/lastEntry";

/**
 * "My last order", and the way back to it.
 *
 * The owner, 2026-10-05: «ڕیتێرن لە کڕین بە تێچوو، لە پاکێجی تەواویش هەبێ،
 * زۆر گرنگە». The entry forms empty themselves for the next order the moment
 * one is saved — which is right for entering twenty in a row, and is exactly
 * when a wrong price or a wrong quantity is noticed. The order just saved was
 * a search through the list away.
 *
 * So the form names it, and one press opens it in the ordinary edit form:
 * the same boxes it was typed into, and every rule an edit already has — the
 * reason asked for when money moves, the difference written on the account,
 * the confirmation before anything is saved. Nothing about how an order is
 * corrected is decided here; this is only the door.
 *
 * A real link, so the leave guard asks first when the form underneath holds
 * a half-typed order. Shown only for an order entered this working day
 * (shared/lastEntry), and never while editing.
 */
export function LastOrderStrip({ orderType }: { orderType: EntryOrderType }) {
  const { language } = useTranslation();
  const { data: last } = trpc.fullPackage.lastCreatedByMe.useQuery(
    { orderType },
    { staleTime: 0, refetchOnWindowFocus: false },
  );

  if (!last || !isRecentEntry(last.createdAt)) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-teal-50/50 px-4 py-2.5 text-sm dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-teal-950/20"
      data-testid="last-order-strip"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {pickLang(language, { ku: "دوایین ئۆردەرت", en: "Your last order", ar: "آخر طلب لك", zh: "您的上一个订单" })}
      </span>
      <bdi dir="ltr" className="font-mono font-bold text-foreground">{last.orderCode}</bdi>
      {last.customerCode && (
        <bdi dir="ltr" className="font-mono text-muted-foreground">{last.customerCode}</bdi>
      )}
      {last.productName && (
        <span className="min-w-0 max-w-[16rem] truncate text-muted-foreground" title={last.productName}>
          {last.productName}
        </span>
      )}
      <OrderNumbers numbers={last.orderNumber} className="text-xs" />
      <Link
        href={lastOrderEditHref(orderType, last.id)}
        className="ms-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-emerald-300 bg-white/80 px-3 text-sm font-medium text-emerald-800 transition-colors hover:bg-white dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900/60"
        data-testid="last-order-correct"
      >
        <PencilLine className="h-3.5 w-3.5" />
        {pickLang(language, { ku: "هەڵەیە؟ چاکی بکەرەوە", en: "Wrong? Correct it", ar: "خطأ؟ صحّحه", zh: "有误？更正" })}
      </Link>
    </div>
  );
}
