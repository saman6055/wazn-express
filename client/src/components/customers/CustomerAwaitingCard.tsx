import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageSearch, Clock, UserCircle, ShoppingBag, AlertTriangle } from "lucide-react";

type L = { ku: string; en: string; ar: string; zh: string };

type Awaited = {
  trackingNumber: string;
  origin: "order" | "customer";
  customerId: number | null;
  daysWaiting: number;
  isLate: boolean;
  productName: string | null;
  order: { orderCode: string } | null;
};

/**
 * What this customer has coming that has not reached the China warehouse.
 *
 * The office needs this before the goods land, not after: it is what you read
 * out when the customer calls to ask where their parcel is, and what tells you
 * to warn them that something they declared in the portal never showed up.
 *
 * Silent when there is nothing outstanding — an always-present empty card
 * teaches people to skip past it.
 */
export function CustomerAwaitingCard({ customerId, className }: { customerId: number; className?: string }) {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);

  const { data, isLoading } = trpc.packages.awaitingArrival.useQuery(undefined, {
    staleTime: 120_000,
    retry: false,
  });

  if (isLoading) return <Skeleton className={cn("h-32 w-full rounded-2xl", className)} />;

  const rows = ((data ?? []) as Awaited[]).filter((r) => r.customerId === customerId);
  if (rows.length === 0) return null;

  const late = rows.filter((r) => r.isLate).length;

  return (
    <Card className={cn("overflow-hidden rounded-2xl", late > 0 && "border-red-300/80 dark:border-red-800/70", className)}>
      <div className={cn("h-1 bg-gradient-to-r", late > 0 ? "from-red-400 to-rose-600" : "from-amber-300 to-orange-500")} />
      <CardContent className="pt-4">
        <div className="mb-1 flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-bold">
            {label({ ku: "نەگەیشتووەکان", en: "Not yet arrived", ar: "لم تصل بعد", zh: "尚未到达" })}
          </h3>
          <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            {rows.length}
          </span>
          {late > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-200">
              <AlertTriangle className="h-3 w-3" />
              {label({ ku: `${late} دواکەوتوو`, en: `${late} late`, ar: `${late} متأخر`, zh: `${late} 逾期` })}
            </span>
          )}
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          {label({
            ku: "ئەو پاکێجانەی هێشتا نەگەیشتوون بە کۆگای چین",
            en: "Parcels that have not reached the China warehouse yet",
            ar: "الطرود التي لم تصل بعد إلى مستودع الصين",
            zh: "尚未抵达中国仓库的包裹",
          })}
        </p>

        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={`${r.trackingNumber}-${r.origin}`}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2",
                r.isLate && "border-red-300 bg-red-50/50 dark:border-red-800/70 dark:bg-red-950/20",
              )}
            >
              <span className="shrink-0 font-mono text-[11.5px]" dir="ltr">{r.trackingNumber}</span>

              {r.origin === "customer" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-teal-100 px-1.5 py-0.5 text-[10.5px] font-medium text-teal-800 dark:bg-teal-950/50 dark:text-teal-200">
                  <UserCircle className="h-3 w-3" />
                  {label({ ku: "لە پۆرتال", en: "portal", ar: "البوابة", zh: "门户" })}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10.5px] font-medium text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                  <ShoppingBag className="h-3 w-3" />
                  {r.order?.orderCode ?? label({ ku: "ئۆردەر", en: "order", ar: "طلب", zh: "订单" })}
                </span>
              )}

              {r.productName && (
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{r.productName}</span>
              )}

              <span className={cn(
                "ms-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                r.isLate
                  ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
                  : "bg-muted text-muted-foreground",
              )}>
                <Clock className="h-3 w-3" />
                <span dir="ltr">{r.daysWaiting}</span>
                {label({ ku: "ڕۆژ", en: "d", ar: "يوم", zh: "天" })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
