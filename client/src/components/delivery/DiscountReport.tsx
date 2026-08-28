import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Percent, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import type { DiscountReason } from "@shared/boxSettlement";

/**
 * How much has been given away, and on what grounds.
 *
 * Every discount is a line attached to a parcel with a reason on it, and a
 * parcel knows its batch and its customer — so month, batch, code and reason
 * are four readings of the same rows rather than four things to record. That
 * is the whole reason a reason is compulsory at the counter: without it this
 * screen is a single number nobody can act on.
 *
 * Deliberately read-only, and deliberately here rather than in the accounts
 * section. This is money that left through the box, and the box is where it
 * can be understood.
 */

const REASON_LABELS: Record<DiscountReason, { ku: string; en: string; ar: string; zh: string }> = {
  damaged: { ku: "شکاون یان زیانیان پێگەیشتووە", en: "Damaged in transit", ar: "تضرر أثناء النقل", zh: "运输中损坏" },
  late: { ku: "دواکەوتن لە گەیاندن", en: "Late delivery", ar: "تأخر في التسليم", zh: "延迟送达" },
  goodwill: { ku: "هاندان و ستایش", en: "Goodwill", ar: "مجاملة", zh: "友好折扣" },
  loyal: { ku: "کڕیاری باش", en: "Loyal customer", ar: "عميل مميز", zh: "老客户" },
  rounding: { ku: "خڕکردنەوەی دینار", en: "Dinar rounding", ar: "تقريب الدينار", zh: "第纳尔取整" },
  other: { ku: "هۆکارێکی تر", en: "Other", ar: "سبب آخر", zh: "其他" },
};

const money = (n: number) => `$${n.toFixed(2)}`;

/** The first of the month, so the default view is "this month so far". */
function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function DiscountReport() {
  const { language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState("");

  const t = (k: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, k);

  const { data, isLoading } = trpc.deliveryBox.discountReport.useQuery(
    {
      startDate: startDate ? new Date(startDate + "T00:00:00").toISOString() : undefined,
      endDate: endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined,
    },
    // Nothing is fetched until somebody opens it: this is a report, and the
    // delivery screen is opened all day to do other things.
    { enabled: open },
  );

  const max = useMemo(
    () => Math.max(1, ...(data?.byReason ?? []).map((r) => r.totalUsd)),
    [data],
  );

  return (
    <Card data-testid="discount-report">
      <CardContent className="space-y-4 pt-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 text-start"
          data-testid="discount-report-toggle"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
            <Percent className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">
              {t({ ku: "ڕاپۆرتی داشکاندن", en: "Discount report", ar: "تقرير الخصومات", zh: "折扣报表" })}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {t({
                ku: "چەند پارەمان داشکاندووە، و بۆچی",
                en: "How much has been given away, and on what grounds",
                ar: "كم تم خصمه، ولأي سبب",
                zh: "共折让多少，以及原因",
              })}
            </p>
          </div>
          {data && open && (
            <span className="font-mono text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {money(data.totalUsd)}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>

        {open && (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">
                  {t({ ku: "لە", en: "From", ar: "من", zh: "从" })}
                </span>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                       className="h-9 w-auto" data-testid="discount-report-start" />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">
                  {t({ ku: "بۆ", en: "To", ar: "إلى", zh: "到" })}
                </span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                       className="h-9 w-auto" data-testid="discount-report-end" />
              </label>
              <Button variant="outline" size="sm" className="h-9"
                      onClick={() => { setStartDate(""); setEndDate(""); }}>
                {t({ ku: "هەموو کاتێک", en: "All time", ar: "كل الفترات", zh: "全部时间" })}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t({ ku: "بارکردن…", en: "Loading…", ar: "جارٍ التحميل…", zh: "加载中…" })}
              </div>
            ) : !data || data.count === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t({
                  ku: "هیچ داشکاندنێک نەکراوە لەم ماوەیەدا",
                  en: "No discount was given in this period",
                  ar: "لم يُمنح أي خصم في هذه الفترة",
                  zh: "此期间未发生折扣",
                })}
              </p>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <span className="font-mono text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {money(data.totalUsd)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {data.count}{" "}
                    {t({ ku: "داشکاندن", en: "discounts", ar: "خصم", zh: "笔折扣" })}
                  </span>
                </div>

                <Section title={t({ ku: "بە هۆکار", en: "By reason", ar: "حسب السبب", zh: "按原因" })}>
                  {data.byReason.map((row) => (
                    <div key={row.reason} className="grid grid-cols-[9rem_1fr_5rem] items-center gap-3 text-sm">
                      <span className="truncate">
                        {t(REASON_LABELS[row.reason as DiscountReason] ?? REASON_LABELS.other)}
                      </span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-amber-500 dark:bg-amber-400"
                              style={{ width: `${Math.round((row.totalUsd / max) * 100)}%` }} />
                      </span>
                      <span className="text-end font-mono tabular-nums text-muted-foreground">
                        {row.totalUsd.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </Section>

                <div className="grid gap-5 md:grid-cols-3">
                  <Section title={t({ ku: "بە مانگ", en: "By month", ar: "حسب الشهر", zh: "按月份" })}>
                    {data.byMonth.map((row) => (
                      <Line key={row.ym} label={row.ym} value={row.totalUsd} count={row.count} ltr />
                    ))}
                  </Section>

                  <Section title={t({ ku: "بە کۆدی کڕیار", en: "By customer", ar: "حسب العميل", zh: "按客户" })}>
                    {data.byCustomer.slice(0, 8).map((row) => (
                      <Line key={row.customerId} label={row.customerCode ?? `#${row.customerId}`}
                            value={row.totalUsd} count={row.count} ltr />
                    ))}
                  </Section>

                  <Section title={t({ ku: "بە باچ", en: "By batch", ar: "حسب الدفعة", zh: "按批次" })}>
                    {data.byBatch.slice(0, 8).map((row) => (
                      <Line key={String(row.batchId)} value={row.totalUsd} count={row.count} ltr
                            label={row.batchCode ?? t({ ku: "بێ باچ", en: "No batch", ar: "بدون دفعة", zh: "无批次" })} />
                    ))}
                  </Section>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Line({ label, value, count, ltr }: { label: string; value: number; count: number; ltr?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className={cn("truncate", ltr && "font-mono text-xs")} dir={ltr ? "ltr" : undefined}>
        {label}
      </span>
      <span className="shrink-0 font-mono tabular-nums">
        {value.toFixed(2)}
        <span className="ms-1 text-xs text-muted-foreground">({count})</span>
      </span>
    </div>
  );
}
