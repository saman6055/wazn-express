import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PackageSearch, Search, Copy, Clock, AlertTriangle, Users, ShoppingBag,
  UserCircle, ExternalLink, ImageOff, CheckCircle2, Hourglass,
} from "lucide-react";
import { useLocation } from "wouter";

type L = { ku: string; en: string; ar: string; zh: string };

type Awaited = {
  trackingNumber: string;
  origin: "order" | "customer";
  customerId: number | null;
  customerName: string | null;
  customerCode: string | null;
  knownSince: string | Date | null;
  daysWaiting: number;
  isLate: boolean;
  productName: string | null;
  productImage: string | null;
  order: { id: number; orderCode: string; orderType: string; status: string } | null;
};

const ORDER_PATH: Record<string, string> = {
  full_package: "/full-package",
  commission: "/commission",
  purchase_request: "/full-package",
};

const ORDER_LABEL: Record<string, L> = {
  full_package: { ku: "پاکێجی تەواو", en: "Complete package", ar: "الحزمة الكاملة", zh: "完整包裹" },
  commission: { ku: "کڕین بە تێچوو", en: "Markup purchase", ar: "شراء بهامش", zh: "加价采购" },
  purchase_request: { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" },
};

function shortDate(v: string | Date | null): string {
  if (!v) return "—";
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

/**
 * Trackings we know about that have not reached the China warehouse.
 *
 * The mirror of the registrations page. Tracking Alerts covers the step before
 * — orders with no tracking yet — and registrations covers the step after,
 * once a parcel is on the shelf. This is the gap between: goods dispatched,
 * tracking known, nothing arrived, and until now no screen saying so.
 *
 * The ones a customer declared in the portal matter most. When one of those
 * goes quiet, the customer is the only person who can chase the seller — and
 * only if somebody tells them it never showed up.
 */
export default function AwaitingArrival() {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "late" | "customer" | "order">("all");

  const { data, isLoading } = trpc.packages.awaitingArrival.useQuery(undefined, { staleTime: 60_000 });

  const all = (data ?? []) as Awaited[];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((r) => {
      if (filter === "late" && !r.isLate) return false;
      if (filter === "customer" && r.origin !== "customer") return false;
      if (filter === "order" && r.origin !== "order") return false;
      if (!term) return true;
      return [r.trackingNumber, r.customerName, r.customerCode, r.productName, r.order?.orderCode]
        .filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [all, search, filter]);

  const totals = useMemo(() => {
    const custs = new Set<number>();
    let late = 0, fromCustomer = 0;
    for (const r of all) {
      if (r.isLate) late++;
      if (r.origin === "customer") fromCustomer++;
      if (r.customerId) custs.add(r.customerId);
    }
    return { total: all.length, late, fromCustomer, customers: custs.size };
  }, [all]);

  const copy = (tn: string) => {
    navigator.clipboard.writeText(tn);
    toast.success(label({ ku: "تراک کۆپی کرا", en: "Tracking copied", ar: "تم نسخ التتبّع", zh: "已复制追踪号" }));
  };

  const filters: { key: typeof filter; text: L; count: number }[] = [
    { key: "all", text: { ku: "هەمووی", en: "All", ar: "الكل", zh: "全部" }, count: totals.total },
    { key: "late", text: { ku: "دواکەوتوو", en: "Late", ar: "متأخر", zh: "逾期" }, count: totals.late },
    { key: "customer", text: { ku: "لە کڕیارەوە", en: "From customer", ar: "من العميل", zh: "客户申报" }, count: totals.fromCustomer },
    { key: "order", text: { ku: "لە ئۆردەرەوە", en: "From order", ar: "من الطلب", zh: "订单" }, count: totals.total - totals.fromCustomer },
  ];

  return (
    <DashboardLayout>
    <div className="space-y-5 p-4 md:p-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-5 text-white shadow-xl ring-1 ring-white/20 md:p-6">
        <div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -start-10 h-56 w-56 rounded-full bg-orange-300/20 blur-3xl" />

        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <PackageSearch className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              {label({ ku: "نەگەیشتووەکان", en: "Not yet arrived", ar: "لم تصل بعد", zh: "尚未到达" })}
            </h1>
            <p className="text-xs text-white/80">
              {label({
                ku: "ئەو پاکێجانەی هێشتا نەگەیشتوون بە کۆگای چین",
                en: "Parcels that have not reached the China warehouse yet",
                ar: "الطرود التي لم تصل بعد إلى مستودع الصين",
                zh: "尚未抵达中国仓库的包裹",
              })}
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat value={String(totals.total)} caption={label({ ku: "چاوەڕوانی", en: "waiting", ar: "بالانتظار", zh: "等待中" })} icon={Hourglass} />
          <Stat value={String(totals.customers)} caption={label({ ku: "کڕیار", en: "customers", ar: "عميل", zh: "客户" })} icon={Users} />
          <Stat value={String(totals.fromCustomer)} caption={label({ ku: "لە پۆرتالەوە", en: "from portal", ar: "من البوابة", zh: "来自门户" })} icon={UserCircle} />
          <Stat value={String(totals.late)} caption={label({ ku: "زیاتر لە ٧ ڕۆژ", en: "over 7 days", ar: "أكثر من ٧ أيام", zh: "超过 7 天" })} icon={AlertTriangle} warn={totals.late > 0} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border bg-muted/40 p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200",
                filter === f.key
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {label(f.text)}
              <span className={cn("rounded-md px-1.5 text-[11px] tabular-nums", filter === f.key ? "bg-white/20" : "bg-muted")}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative ms-auto min-w-[13rem] flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={label({ ku: "تراک، کڕیار، ئۆردەر…", en: "Tracking, customer, order…", ar: "تتبّع، عميل، طلب…", zh: "追踪号、客户、订单…" })}
            className="h-10 rounded-xl ps-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/50 dark:to-teal-950/50">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              {all.length === 0
                ? label({
                    ku: "هەموو بارەکان گەیشتوون — هیچ چاوەڕوانییەک نەماوە",
                    en: "Everything has arrived — nothing outstanding",
                    ar: "وصل كل شيء — لا يوجد معلّق",
                    zh: "全部已到达 — 无待处理项",
                  })
                : label({ ku: "هیچ ئەنجامێک نەدۆزرایەوە", en: "No matches", ar: "لا نتائج", zh: "无匹配结果" })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <AwaitedCard
              key={`${r.trackingNumber}-${r.origin}`}
              row={r}
              language={language}
              onCopy={copy}
              onOpenOrder={() => r.order && setLocation(`${ORDER_PATH[r.order.orderType] ?? "/full-package"}/${r.order.id}`)}
            />
          ))}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}

function Stat({
  value, caption, icon: Icon, warn,
}: {
  value: string; caption: string; icon: React.ComponentType<{ className?: string }>; warn?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl px-3 py-2.5 ring-1 backdrop-blur",
      warn ? "bg-red-500/25 ring-red-200/40" : "bg-white/10 ring-white/15",
    )}>
      <div className="mb-0.5 flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", warn ? "text-red-50" : "text-white/60")} />
        <p className="truncate text-[10.5px] text-white/75">{caption}</p>
      </div>
      <p className="text-xl font-bold tabular-nums" dir="ltr">{value}</p>
    </div>
  );
}

function AwaitedCard({
  row, language, onCopy, onOpenOrder,
}: {
  row: Awaited;
  language: string;
  onCopy: (tn: string) => void;
  onOpenOrder: () => void;
}) {
  const label = (v: L) => pickLang(language, v);
  const [imgBroken, setImgBroken] = useState(false);

  return (
    <Card className={cn(
      "group relative overflow-hidden rounded-2xl border-border/60 transition-all duration-300",
      "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10",
      row.isLate && "border-2 border-red-400/80 bg-red-50/30 shadow-md shadow-red-500/10 dark:border-red-700/70 dark:bg-red-950/15",
    )}>
      <div className={cn(
        "absolute inset-y-0 start-0 w-1 bg-gradient-to-b",
        row.isLate ? "from-red-400 to-rose-600" : "from-amber-300 to-orange-500",
      )} />
      <CardContent className="flex gap-3 p-3 ps-4">
        <div className="shrink-0">
          {row.productImage && !imgBroken ? (
            <img
              src={row.productImage}
              alt=""
              loading="lazy"
              onError={() => setImgBroken(true)}
              className="h-16 w-16 rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
              <ImageOff className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 px-2.5 py-1 font-mono text-xs font-medium text-white shadow-sm shadow-blue-500/25">
              {row.customerCode || "—"}
            </span>
            <span className="truncate text-sm font-medium">{row.customerName || "—"}</span>

            {/* How long, and whether that is still normal. */}
            <span className={cn(
              "ms-auto inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[11.5px] font-medium",
              row.isLate
                ? "bg-red-100 text-red-800 ring-1 ring-red-300 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800"
                : "bg-muted text-muted-foreground",
            )}>
              <Clock className="h-3 w-3" />
              {label({
                ku: `${row.daysWaiting} ڕۆژ`,
                en: `${row.daysWaiting} days`,
                ar: `${row.daysWaiting} يوم`,
                zh: `${row.daysWaiting} 天`,
              })}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5" dir="ltr">
            <button
              type="button"
              onClick={() => onCopy(row.trackingNumber)}
              className="group/tn inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-muted/50 px-2 py-1 font-mono text-[13px] tracking-wide transition-all duration-200 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-800 dark:hover:bg-sky-950/30 dark:hover:text-sky-300"
            >
              {row.trackingNumber}
              <Copy className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover/tn:text-sky-500" />
            </button>
            <span className="text-[11px] text-muted-foreground">{shortDate(row.knownSince)}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {row.origin === "customer" ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-teal-100 px-2.5 py-0.5 text-[11.5px] font-medium text-teal-800 ring-1 ring-teal-300/70 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-800/70">
                <UserCircle className="h-3 w-3" />
                {label({ ku: "کڕیار خۆی تۆماری کردووە", en: "Declared by customer", ar: "أعلنه العميل", zh: "客户申报" })}
              </span>
            ) : row.order ? (
              <button
                type="button"
                onClick={onOpenOrder}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2.5 py-0.5 text-[11.5px] font-medium text-violet-800 ring-1 ring-violet-300/70 transition-colors hover:bg-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-800/70 dark:hover:bg-violet-900/60"
              >
                <ShoppingBag className="h-3 w-3" />
                {label(ORDER_LABEL[row.order.orderType] ?? ORDER_LABEL.full_package)}
                <span className="font-mono text-[10.5px] opacity-75">{row.order.orderCode}</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : null}

            {row.productName && (
              <span className="truncate text-xs text-muted-foreground">{row.productName}</span>
            )}
          </div>

          {/* The reason this page exists: somebody has to tell the customer. */}
          {row.isLate && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-300 bg-red-100/70 px-2.5 py-1.5 dark:border-red-800 dark:bg-red-950/40">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
              <p className="text-[12px] font-medium text-red-800 dark:text-red-200">
                {row.origin === "customer"
                  ? label({
                      ku: `${row.daysWaiting} ڕۆژە نەگەیشتووە — کڕیار ئاگادار بکەوە تا لەگەڵ فرۆشیار پەیوەندی بکات`,
                      en: `${row.daysWaiting} days with no arrival — tell the customer so they can chase the seller`,
                      ar: `${row.daysWaiting} يوماً دون وصول — أبلغ العميل ليتابع مع البائع`,
                      zh: `已 ${row.daysWaiting} 天未到 — 请通知客户联系卖家`,
                    })
                  : label({
                      ku: `${row.daysWaiting} ڕۆژە نەگەیشتووە — تراکەکە پشکنین بکە`,
                      en: `${row.daysWaiting} days with no arrival — check the tracking`,
                      ar: `${row.daysWaiting} يوماً دون وصول — تحقّق من التتبّع`,
                      zh: `已 ${row.daysWaiting} 天未到 — 请核查追踪号`,
                    })}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
