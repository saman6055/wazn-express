/**
 * A tracking with no parcel - and the order that carries it.
 *
 * Owner, 2026-10-15, searching the parcels list for a tracking and getting
 * only "no parcels": "why does the system not show it? I want to look into
 * each tracking's state one by one." A parcel exists only once its carton
 * is scanned at the warehouse; an order entered with a tracking whose carton
 * never arrived has none. So when the list finds nothing, it asks the
 * orders, and says plainly what that means and where to go.
 */
import { Link } from "wouter";
import { PackageX } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { fmtWhen } from "@/lib/numericDate";
import { CopyButton } from "@/components/CopyButton";
import { parcelSourceTarget, type ParcelOrderType } from "@shared/parcelSource";

/** Only something that looks like one tracking is asked about. */
export function looksLikeTracking(search: string): boolean {
  const s = search.trim();
  return s.length >= 6 && !/\s/.test(s);
}

export function TrackingOnAnOrder({ search }: { search: string }) {
  const { language, t } = useTranslation();
  const term = search.trim();
  const enabled = looksLikeTracking(term);
  const { data } = trpc.fullPackage.ordersByTracking.useQuery({ tracking: term }, { enabled, staleTime: 30_000 });
  if (!enabled || !data || data.length === 0) return null;

  return (
    <div className="mb-4 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="tracking-on-an-order">
      <p className="flex items-start gap-2 font-medium">
        <PackageX className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {data[0].parcelRegistered
            ? pickLang(language, {
                ku: "پاکەتێک بەم تراکینگە هەیە، بەڵام فلتەرەکانی ئەم لیستە دەیشارنەوە. ئەم داواکارییانە هەڵیانگرتووە:",
                en: "A parcel with this tracking exists, but this list's filters hide it. These orders carry it:",
                ar: "يوجد طرد بهذا الرقم لكن عوامل التصفية تخفيه. هذه الطلبات تحمله:",
                zh: "存在该单号的包裹，但被本列表的筛选隐藏。以下订单含此单号：",
              })
            : pickLang(language, {
                ku: "هیچ پاکەتێک بەم تراکینگە لە کۆگا تۆمار نەکراوە — کارتۆنەکە هەرگیز نەگەیشتووەتە کۆگا. ئەم داواکارییە تراکینگەکەی هەیە:",
                en: "No parcel with this tracking was ever registered at the warehouse — the carton never reached it. This order carries the tracking:",
                ar: "لم يُسجَّل أي طرد بهذا الرقم في المستودع — لم تصل الكرتونة إليه. هذا الطلب يحمل الرقم:",
                zh: "仓库从未登记该单号的包裹 — 箱子从未到达仓库。以下订单含此单号：",
              })}
        </span>
      </p>
      <ul className="divide-y divide-amber-300/60 rounded-lg border border-amber-300/60 bg-background/70 text-foreground dark:divide-amber-500/30 dark:border-amber-500/30">
        {data.map((o) => {
          const href = parcelSourceTarget([{ orderId: o.orderId, orderType: o.orderType as ParcelOrderType, orderCode: o.orderCode, orderNumber: o.orderNumber }], term).href;
          return (
            <li key={o.orderId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
              <span className="min-w-0 space-y-0.5">
                <Link href={href} className="font-medium underline">
                  <bdi dir="ltr" className="font-mono">{o.orderCode}</bdi>
                </Link>{" "}
                <span className="text-xs text-muted-foreground">
                  <bdi dir="ltr">{o.customerCode}</bdi>
                  {o.productName ? ` · ${o.productName}` : ""}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(`fullPackage.status.${o.status}`) || o.status}
                  {" · "}
                  {pickLang(language, { ku: "تۆمارکراوە", en: "entered", ar: "أُدخل", zh: "录入于" })} <bdi dir="ltr">{fmtWhen(o.createdAt)}</bdi>
                  {" · "}
                  {o.isCharged
                    ? pickLang(language, { ku: "لەسەر حیسابی کڕیارە", en: "on the customer's account", ar: "على حساب العميل", zh: "已记入客户账户" })
                    : pickLang(language, { ku: "لەسەر هیچ حیسابێک نییە", en: "on no account", ar: "ليس على أي حساب", zh: "未记入任何账户" })}
                </span>
                {o.orderNumber && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order no.", ar: "رقم الطلب", zh: "订单号" })} <bdi dir="ltr" className="font-mono">{o.orderNumber}</bdi>
                    <CopyButton value={o.orderNumber} />
                  </span>
                )}
              </span>
              <bdi dir="ltr" className="shrink-0 font-semibold tabular-nums">{fmtUsd(o.sellUsd)}</bdi>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
