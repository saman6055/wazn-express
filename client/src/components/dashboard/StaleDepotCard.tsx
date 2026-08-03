import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Warehouse, Clock, ChevronLeft } from "lucide-react";

type L = { ku: string; en: string; ar: string; zh: string };

type Stale = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerName: string | null;
  customerCode: string | null;
  daysInDepot: number;
};

/**
 * Parcels on the China shelf that no batch has picked up.
 *
 * A registration that never joins a batch never ships. Nothing surfaced that,
 * so a forgotten box could sit for a month while the customer waited and the
 * office assumed it was on its way. Silent when there is nothing to report —
 * a card that is always on screen stops being read.
 */
export function StaleDepotCard({ className }: { className?: string }) {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);

  const { data, isLoading } = trpc.packages.staleInDepot.useQuery(undefined, {
    staleTime: 300_000,
    retry: false,
  });

  if (isLoading) return <Skeleton className={cn("h-40 w-full rounded-2xl", className)} />;

  const rows = (data ?? []) as Stale[];
  if (rows.length === 0) return null;

  const oldest = rows[0]?.daysInDepot ?? 0;

  return (
    <Card className={cn("overflow-hidden rounded-2xl border-amber-300/80 dark:border-amber-800/70", className)}>
      <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
      <CardContent className="pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Warehouse className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-bold">
            {label({
              ku: "لە کۆگای چین ماونەتەوە",
              en: "Stuck in the China warehouse",
              ar: "عالقة في مستودع الصين",
              zh: "滞留在中国仓库",
            })}
          </h3>
          <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            {rows.length}
          </span>
          <Link
            href="/packages/registrations"
            className="ms-auto inline-flex items-center gap-0.5 text-xs font-medium text-sky-600 dark:text-sky-400"
          >
            {label({ ku: "بینینی هەمووی", en: "See all", ar: "عرض الكل", zh: "查看全部" })}
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          {label({
            ku: `${rows.length} پارچە تۆمار کراون بەڵام نەخراونەتە ناو هیچ باچێک — کۆنترینیان ${oldest} ڕۆژە`,
            en: `${rows.length} parcel(s) registered but in no batch — the oldest has waited ${oldest} days`,
            ar: `${rows.length} طرد مسجّل دون إدراجه في أي دفعة — أقدمها ${oldest} يوماً`,
            zh: `${rows.length} 个包裹已登记但未入任何批次 — 最久的已 ${oldest} 天`,
          })}
        </p>

        <div className="space-y-1.5">
          {rows.slice(0, 4).map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-xl border px-3 py-2">
              <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 font-mono text-[11px] text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {r.customerCode ?? "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">{r.customerName ?? "—"}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground" dir="ltr">
                {r.trackingNumber ?? r.packageCode}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                <Clock className="h-3 w-3" />
                <span dir="ltr">{r.daysInDepot}</span>
              </span>
            </div>
          ))}
        </div>

        {rows.length > 4 && (
          <p className="mt-2 text-center text-[11.5px] text-muted-foreground">
            {label({
              ku: `و ${rows.length - 4}ی تر`,
              en: `and ${rows.length - 4} more`,
              ar: `و${rows.length - 4} أخرى`,
              zh: `另有 ${rows.length - 4} 个`,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
