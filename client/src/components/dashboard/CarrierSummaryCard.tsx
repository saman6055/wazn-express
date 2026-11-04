import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Gauge, Timer, TrendingDown, TrendingUp, Trophy } from "lucide-react";

type L = { ku: string; en: string; ar: string; zh: string };

/**
 * The carriers side by side (owner, 2026-11-05): our kilos this week and this
 * month, the carrier's billed kilos, how many days on the road, and what each
 * billed per kilo. The fastest and the cheapest are marked. Read only; every
 * figure is from what the batches record (server/db/carrierSummary).
 */
export function CarrierSummaryCard({ className }: { className?: string }) {
  const { language } = useLanguage();
  const t = (w: L) => pickLang(language, w);
  const { data } = trpc.dashboard.carrierSummary.useQuery(undefined, { staleTime: 5 * 60_000 });
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const maxMonth = Math.max(1, ...rows.map((r) => r.ourKgMonth));
  const timed = rows.filter((r) => r.avgDays != null && r.arrivedCount > 0);
  const fastest = timed.length > 1 ? timed.reduce((a, b) => ((b.avgDays ?? 1e9) < (a.avgDays ?? 1e9) ? b : a)).carrier : null;
  const priced = rows.filter((r) => r.usdPerKg != null);
  const cheapest = priced.length > 1 ? priced.reduce((a, b) => ((b.usdPerKg ?? 1e9) < (a.usdPerKg ?? 1e9) ? b : a)).carrier : null;

  return (
    <Card className={cn("pro-card overflow-hidden", className)} data-testid="carrier-summary">
      <CardHeader className="border-b bg-violet-50/50 py-4 dark:bg-violet-950/20">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-violet-500 dark:text-violet-400" />
              {t({ ku: "کۆمپانیاکانی گواستنەوە", en: "Carriers", ar: "شركات الشحن", zh: "承运商" })}
            </CardTitle>
            <CardDescription>
              {t({ ku: "کیلۆی ئێمە، کیلۆی وەسڵ، ماوەی ڕێگا و نرخی کیلۆ", en: "Our kilos, billed kilos, days on the road, price per kilo", ar: "كيلوغراماتنا، المفوترة، أيام الطريق، سعر الكيلو", zh: "我方公斤、计费公斤、在途天数、每公斤价格" })}
            </CardDescription>
          </div>
          <Link href="/batches">
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t({ ku: "باچەکان", en: "Batches", ar: "الدفعات", zh: "批次" })}</Badge>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {rows.map((r) => {
          const change = r.ourKgPrevWeek > 0 ? Math.round(((r.ourKgWeek - r.ourKgPrevWeek) / r.ourKgPrevWeek) * 100) : null;
          return (
            <div key={r.carrier} className="space-y-2 px-4 py-3" data-testid="carrier-row">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold" dir="ltr">{r.carrier}</span>
                {r.carrier === fastest && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                    <Trophy className="h-3 w-3" />{t({ ku: "خێراترین", en: "Fastest", ar: "الأسرع", zh: "最快" })}
                  </span>
                )}
                {r.carrier === cheapest && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    <Trophy className="h-3 w-3" />{t({ ku: "هەرزانترین", en: "Cheapest", ar: "الأرخص", zh: "最便宜" })}
                  </span>
                )}
                <span className="ms-auto text-xs text-muted-foreground">
                  {t({ ku: `${r.batchesMonth} باچ لە 30 ڕۆژدا`, en: `${r.batchesMonth} batches in 30 days`, ar: `${r.batchesMonth} دفعة خلال 30 يوماً`, zh: `30天内 ${r.batchesMonth} 批` })}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-violet-500 transition-[width] duration-700"
                  style={{ width: `${Math.max(3, Math.round((r.ourKgMonth / maxMonth) * 100))}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">{t({ ku: "ئەم هەفتە", en: "This week", ar: "هذا الأسبوع", zh: "本周" })}</p>
                  <p className="flex items-center gap-1 font-semibold tabular-nums" dir="ltr">
                    {r.ourKgWeek.toFixed(1)} kg
                    {change != null && change !== 0 && (
                      <span className={cn("inline-flex items-center text-[10px]", change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                        {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(change)}%
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t({ ku: "ئەم مانگە", en: "30 days", ar: "30 يوماً", zh: "30天" })}</p>
                  <p className="font-semibold tabular-nums" dir="ltr">{r.ourKgMonth.toFixed(1)} kg</p>
                  {r.carrierKgMonth > 0 && (
                    <p className="text-[10px] text-muted-foreground" dir="ltr">
                      {t({ ku: "وەسڵ", en: "billed", ar: "مفوتر", zh: "计费" })} {r.carrierKgMonth.toFixed(1)} kg
                    </p>
                  )}
                </div>
                <div>
                  <p className="flex items-center gap-1 text-muted-foreground"><Timer className="h-3 w-3" />{t({ ku: "ماوەی ڕێگا", en: "On the road", ar: "مدة الطريق", zh: "在途" })}</p>
                  <p className="font-semibold tabular-nums">
                    {r.avgDays != null ? t({ ku: `${r.avgDays} ڕۆژ`, en: `${r.avgDays} days`, ar: `${r.avgDays} يوم`, zh: `${r.avgDays} 天` }) : "—"}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-muted-foreground"><Gauge className="h-3 w-3" />{t({ ku: "نرخی کیلۆ", en: "Per kilo", ar: "سعر الكيلو", zh: "每公斤" })}</p>
                  <p className="font-semibold tabular-nums" dir="ltr">{r.usdPerKg != null ? `$${r.usdPerKg.toFixed(2)}` : "—"}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
