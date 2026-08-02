import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PackagePlus, ChevronLeft } from "lucide-react";
import { SHIPPING_TYPE_LABEL } from "@/lib/shipmentFilters";

type L = { ku: string; en: string; ar: string; zh: string };

/**
 * Today's intake at Quick Register, totalled and broken down per customer.
 *
 * A dashboard answers "how did today go" at a glance; the Registrations tab
 * on the packages page is where the individual parcels get worked on. So this
 * shows sums and the busiest few customers, and links across for the rest —
 * a list of every tracking number here would be a worse version of that page.
 */
export function RegistrationsSummaryCard({ className }: { className?: string }) {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);

  const { data, isLoading } = trpc.packages.registrationSummary.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return <Skeleton className={cn("h-56 w-full rounded-2xl", className)} />;
  }

  const totals = data?.totals;
  // Nothing came in today. Saying so plainly beats a grid of zeroes.
  if (!totals || totals.pieces === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center gap-3 py-6">
          <PackagePlus className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {label({
              ku: "ئەمڕۆ هێشتا هیچ تۆمارێک نەکراوە",
              en: "Nothing registered yet today",
              ar: "لم يُسجَّل شيء اليوم بعد",
              zh: "今天尚无登记",
            })}
          </p>
        </CardContent>
      </Card>
    );
  }

  const stat = (value: string, caption: string, tone?: "warn") => (
    <div className="rounded-xl border bg-muted/30 px-3 py-2">
      <p className={cn("text-lg font-bold tabular-nums", tone === "warn" && "text-amber-600 dark:text-amber-400")}>
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground">{caption}</p>
    </div>
  );

  return (
    <Card className={className}>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center gap-2">
          <PackagePlus className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h3 className="font-bold">
            {label({
              ku: "تۆمارەکانی تۆماری خێرا — ئەمڕۆ",
              en: "Quick Register intake — today",
              ar: "تسجيلات اليوم",
              zh: "今日登记",
            })}
          </h3>
          <Link
            href="/packages/registrations"
            className="ms-auto inline-flex items-center gap-0.5 text-xs font-medium text-sky-600 dark:text-sky-400"
          >
            {label({ ku: "هەمووی", en: "All", ar: "الكل", zh: "全部" })}
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {stat(String(totals.pieces), label({ ku: "پارچە", en: "pieces", ar: "قطعة", zh: "件" }))}
          {stat(String(totals.customers), label({ ku: "کڕیار", en: "customers", ar: "عميل", zh: "客户" }))}
          {stat(totals.airWeightKg.toFixed(1), label({ ku: "کیلۆ · ئاسمانی", en: "kg · air", ar: "كغ · جوي", zh: "公斤 · 空运" }))}
          {stat(totals.seaCbm.toFixed(2), label({ ku: "CBM · دەریایی", en: "CBM · sea", ar: "م³ · بحري", zh: "立方米 · 海运" }))}
          {/* Estimated, not billed: derived from the active pricing rules, the
              same ones the scanner uses. */}
          {stat(`$${Math.round(totals.estimatedValueUsd)}`, label({ ku: "نرخی خەمڵێنراو", en: "est. value", ar: "قيمة تقديرية", zh: "估值" }))}
          {stat(
            String(totals.missingWeight + totals.unclaimed),
            label({ ku: "کەموکوڕی", en: "incomplete", ar: "ناقص", zh: "不完整" }),
            totals.missingWeight + totals.unclaimed > 0 ? "warn" : undefined,
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          {(data?.byCustomer ?? []).slice(0, 3).map((c) => (
            <div key={c.customerId ?? "unclaimed"} className="rounded-xl border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 font-mono text-[11px] text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  {c.customerCode ?? label({ ku: "بێ خاوەن", en: "Unclaimed", ar: "بلا مالك", zh: "无主" })}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">{c.customerName ?? "—"}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground" dir="ltr">
                  {c.pieces} · {c.cbm > 0 ? `${c.cbm.toFixed(2)} CBM` : `${c.weightKg.toFixed(2)} kg`}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {c.categories.slice(0, 3).map((cat) => (
                  <span key={cat} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {cat}
                  </span>
                ))}
                {c.shippingTypes.map((type) => (
                  <span key={type} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {SHIPPING_TYPE_LABEL[type] ? pickLang(language, SHIPPING_TYPE_LABEL[type]) : type}
                  </span>
                ))}
                <span className="ms-auto text-[10px] tabular-nums text-muted-foreground" dir="ltr">
                  ${Math.round(c.estimatedValueUsd)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {(data?.byCustomer?.length ?? 0) > 3 && (
          <Link
            href="/packages/registrations"
            className="mt-2 block text-center text-[11.5px] font-medium text-sky-600 dark:text-sky-400"
          >
            {label({
              ku: `بینینی هەموو ${data!.byCustomer.length} کڕیارەکە`,
              en: `See all ${data!.byCustomer.length} customers`,
              ar: `عرض كل ${data!.byCustomer.length} عميل`,
              zh: `查看全部 ${data!.byCustomer.length} 位客户`,
            })}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
