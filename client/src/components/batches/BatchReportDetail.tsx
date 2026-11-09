import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ChevronDown, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToCSV } from "@/components/ExportUtils";

/**
 * The batch report in detail (owner, 2026-11-09). Everything read from
 * batches.getReportDetail, whose money figures add up to the report's own
 * cards (server/db/batchReport). Laid out as agreed: a red line when there is a
 * loss, the weights and averages, the kinds and categories with their
 * pictures; speed, problems, sources and the last batch fold away under
 * «زیاتر». The per-customer profit goes on the customer table below it.
 */
type Words = { ku: string; en: string; ar: string; zh: string };
type Detail = NonNullable<ReturnType<typeof useBatchReportDetail>["data"]>;
const PALETTE = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4", "#a3a3a3"];

const KIND_WORDS: Record<string, Words> = {
  self: { ku: "سێلف ئۆردەر", en: "Self order", ar: "طلب ذاتي", zh: "自购" },
  commission: { ku: "عمولە", en: "Commission", ar: "عمولة", zh: "佣金" },
  full_package: { ku: "فول پاکێج", en: "Full package", ar: "حزمة كاملة", zh: "全包" },
  purchase_request: { ku: "داواکاریی کڕین", en: "Purchase request", ar: "طلب شراء", zh: "代购" },
};

export function useBatchReportDetail(batchId: number | null) {
  return trpc.batches.getReportDetail.useQuery({ batchId: batchId ?? 0 }, { enabled: !!batchId });
}

const qtyText = (n: number, unit: "kg" | "cbm") => (unit === "cbm" ? `${n.toFixed(3)} m³` : `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg`);

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-mono text-lg font-bold tabular-nums", tone === "good" && "text-emerald-600 dark:text-emerald-300", tone === "bad" && "text-rose-600 dark:text-rose-300")} dir="ltr">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function BatchReportDetail({ detail, batchCode, profit, language }: { detail: Detail; batchCode: string; profit: number; language: string }) {
  const L = (w: Words) => pickLang(language, w);
  const [more, setMore] = useState(false);
  const unit = detail.unit;
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmtUsd(Math.abs(n))}`;

  const sharePie = (() => {
    const top = detail.perCustomer.slice().sort((a, b) => b.sharePercent - a.sharePercent);
    const head = top.slice(0, 6).map((c) => ({ name: c.code ?? `#${c.customerId}`, value: c.sharePercent }));
    const rest = top.slice(6).reduce((t, c) => t + c.sharePercent, 0);
    return rest > 0 ? [...head, { name: L({ ku: "ئەوانی تر", en: "Others", ar: "آخرون", zh: "其他" }), value: Math.round(rest * 10) / 10 }] : head;
  })();
  const profitBars = detail.perCustomer.filter((c) => c.profit !== null).map((c) => ({ name: c.code ?? `#${c.customerId}`, profit: c.profit as number }));

  const exportCsv = () => exportToCSV({
    title: `${L({ ku: "ڕاپۆرتی باچ", en: "Batch report", ar: "تقرير الدفعة", zh: "批次报告" })} ${batchCode}`,
    headers: ["Code", "Name", "Parcels", "Actual kg", "Volumetric kg", "Chargeable kg", "CBM", "Share %", "Revenue $", "Cost $", "Profit $", "Returning"],
    rows: detail.perCustomer.map((c) => [c.code ?? "", c.name ?? "", c.parcels, c.actualKg, c.volumetricKg, c.chargeableKg, c.cbm, c.sharePercent, c.revenue, c.cost, c.profit ?? "", c.returning ? "yes" : "no"]),
  }, `batch-${batchCode}`);

  return (
    <div className="space-y-4" data-testid="batch-report-detail">
      {/* 1. A loss is said first, in red. */}
      {!detail.waiting && (profit < 0 || detail.lossCustomers > 0) && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200" data-testid="batch-loss-line">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {profit < 0 && L({ ku: `ئەم باچە بە زیان تەواو بوو: ${signed(profit)}. `, en: `This batch ran at a loss: ${signed(profit)}. `, ar: `هذه الدفعة خاسرة: ${signed(profit)}. `, zh: `本批次亏损：${signed(profit)}。` })}
            {detail.lossCustomers > 0 && L({ ku: `${detail.lossCustomers} کڕیار زیانیان پێ گەیاندین — لە خشتەی خوارەوە بە سوور.`, en: `${detail.lossCustomers} customers cost us money — in red in the table below.`, ar: `${detail.lossCustomers} عملاء بخسارة — بالأحمر في الجدول.`, zh: `${detail.lossCustomers} 位客户亏损 — 见下表红色。` })}
          </span>
        </div>
      )}

      {/* 2. Weights and averages. */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {unit === "kg" ? (
          <>
            <Stat label={L({ ku: "کێشی ڕاستەقینە", en: "Actual weight", ar: "الوزن الفعلي", zh: "实重" })} value={qtyText(detail.weights.actualKg, "kg")} />
            <Stat label={L({ ku: "کێشی قەبارەیی", en: "Volumetric weight", ar: "الوزن الحجمي", zh: "体积重" })} value={qtyText(detail.weights.volumetricKg, "kg")} />
            <Stat label={L({ ku: "کێشی حیسابکراو", en: "Chargeable weight", ar: "الوزن المحتسب", zh: "计费重" })} value={qtyText(detail.weights.chargeableKg, "kg")}
              sub={detail.weights.volumetricDiscountKg > 0 ? L({ ku: `داشکانی قەبارەیی: ${detail.weights.volumetricDiscountKg} kg`, en: `Volumetric discount: ${detail.weights.volumetricDiscountKg} kg`, ar: `خصم حجمي: ${detail.weights.volumetricDiscountKg} kg`, zh: `体积折扣：${detail.weights.volumetricDiscountKg} kg` }) : undefined} />
          </>
        ) : (
          <Stat label="CBM" value={qtyText(detail.weights.cbm, "cbm")} />
        )}
        <Stat label={L({ ku: "تێکڕای هەر پاکەتێک", en: "Average per parcel", ar: "متوسط الطرد", zh: "每件平均" })} value={qtyText(detail.averages.perParcelQty, unit)} />
        <Stat label={L({ ku: `فرۆشتن بۆ هەر ${unit === "kg" ? "کیلۆ" : "CBM"}`, en: `Sell per ${unit}`, ar: `البيع لكل ${unit}`, zh: `每${unit}售价` })} value={fmtUsd(detail.averages.sellPerUnit)}
          sub={detail.averages.costPerUnit !== null ? L({ ku: `تێچوو ${fmtUsd(detail.averages.costPerUnit)}`, en: `cost ${fmtUsd(detail.averages.costPerUnit)}`, ar: `التكلفة ${fmtUsd(detail.averages.costPerUnit)}`, zh: `成本 ${fmtUsd(detail.averages.costPerUnit)}` }) : undefined} />
        {detail.averages.profitPerUnit !== null && (
          <Stat label={L({ ku: `قازانجی هەر ${unit === "kg" ? "کیلۆ" : "CBM"}`, en: `Profit per ${unit}`, ar: `الربح لكل ${unit}`, zh: `每${unit}利润` })} value={signed(detail.averages.profitPerUnit)} tone={detail.averages.profitPerUnit >= 0 ? "good" : "bad"} />
        )}
        <Stat label={L({ ku: "کڕیاران", en: "Customers", ar: "العملاء", zh: "客户" })} value={String(detail.customers.total)}
          sub={L({ ku: `${detail.customers.newcomers} نوێ · ${detail.customers.returning} بەردەوام`, en: `${detail.customers.newcomers} new · ${detail.customers.returning} returning`, ar: `${detail.customers.newcomers} جديد · ${detail.customers.returning} دائم`, zh: `${detail.customers.newcomers} 新 · ${detail.customers.returning} 老` })} />
        <Stat label={L({ ku: "تێکڕای داهاتی کڕیارێک", en: "Revenue per customer", ar: "إيراد العميل", zh: "每客户收入" })} value={fmtUsd(detail.averages.revenuePerCustomer)} />
      </div>

      {/* 3. Kinds of goods, and what they were. */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-2 text-sm font-semibold">{L({ ku: "بە پێی جۆری کاڵا", en: "By kind of goods", ar: "حسب نوع البضاعة", zh: "按货物类型" })}</p>
          <div className="space-y-1.5">
            {detail.byKind.map((k) => (
              <div key={k.kind} className="flex items-center justify-between gap-2 border-b py-1 text-sm last:border-0" data-testid={`batch-kind-${k.kind}`}>
                <span className="font-medium">{L(KIND_WORDS[k.kind] ?? KIND_WORDS.self)}</span>
                <span className="text-xs text-muted-foreground">{k.parcels} · <bdi dir="ltr">{qtyText(k.qty, unit)}</bdi></span>
                <span className="font-mono tabular-nums" dir="ltr">{fmtUsd(k.revenue)}</span>
                {k.profit !== null && <span className={cn("font-mono text-xs tabular-nums", k.profit >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")} dir="ltr">{signed(k.profit)}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-2 text-sm font-semibold">{L({ ku: "کاڵاکان چی بوون", en: "What the goods were", ar: "ما هي البضائع", zh: "货物类别" })}</p>
          <div className="space-y-1.5">
            {detail.byCategory.slice(0, 8).map((c) => (
              <div key={String(c.categoryId)} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{c.icon ? `${c.icon} ` : ""}{c.categoryId ? (language === "ku" ? c.nameKu ?? c.nameEn : c.nameEn ?? c.nameKu) : L({ ku: "بێ پۆل", en: "No category", ar: "بلا فئة", zh: "未分类" })}</span>
                  <span className="text-xs text-muted-foreground">{c.parcels} · <bdi dir="ltr" className="tabular-nums">{c.sharePercent}%</bdi></span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${Math.min(100, c.sharePercent)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Pictures: each customer's part of the batch, and each one's profit. */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-1 text-sm font-semibold">{L({ ku: "بەشی هەر کڕیارێک لە باچەکە", en: "Each customer's part of the batch", ar: "حصة كل عميل", zh: "各客户占比" })}</p>
          <div className="h-48" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sharePie} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="90%" paddingAngle={2} stroke="none">
                  {sharePie.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {sharePie.map((p, i) => (
              <span key={p.name} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><bdi dir="ltr" className="font-mono">{p.name}</bdi> {p.value}%</span>
            ))}
          </div>
        </div>
        {profitBars.length > 0 && (
          <div className="rounded-xl border bg-card p-3">
            <p className="mb-1 text-sm font-semibold">{L({ ku: "قازانج و زیانی هەر کڕیارێک", en: "Profit or loss per customer", ar: "ربح أو خسارة كل عميل", zh: "各客户盈亏" })}</p>
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitBars} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.7 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(v: number) => signed(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {profitBars.map((b, i) => <Cell key={i} fill={b.profit >= 0 ? "#10b981" : "#f43f5e"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 5. The rest, folded away until asked for. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setMore((v) => !v)} data-testid="batch-report-more">
          <ChevronDown className={cn("me-1 h-4 w-4 transition-transform", more && "rotate-180")} />
          {L({ ku: "زیاتر: خێرایی، کێشەکان، سەرچاوە، باچی پێشوو", en: "More: speed, problems, sources, last batch", ar: "المزيد: السرعة، المشاكل، المصادر، الدفعة السابقة", zh: "更多：速度、问题、来源、上一批" })}
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} data-testid="batch-report-csv">
          <Download className="me-1 h-4 w-4" />Excel
        </Button>
      </div>
      {more && (
        <div className="grid gap-3 md:grid-cols-2" data-testid="batch-report-more-body">
          <div className="space-y-1 rounded-xl border bg-card p-3 text-sm">
            <p className="font-semibold">{L({ ku: "خێرایی و کێشەکان", en: "Speed and problems", ar: "السرعة والمشاكل", zh: "速度与问题" })}</p>
            {detail.speed && <p>{L({ ku: `تێکڕای تۆمارکردن تا گەیشتن: ${detail.speed.avgDays} ڕۆژ (درەنگترین ${detail.speed.maxDays})`, en: `Registration to arrival: ${detail.speed.avgDays} days on average (slowest ${detail.speed.maxDays})`, ar: `من التسجيل للوصول: ${detail.speed.avgDays} يوماً (الأبطأ ${detail.speed.maxDays})`, zh: `登记到到达平均 ${detail.speed.avgDays} 天（最慢 ${detail.speed.maxDays}）` })}</p>}
            <p>{L({ ku: `بێ خاوەن: ${detail.problems.unclaimed} · گەڕاوە/هەڵوەشاوە: ${detail.problems.returnedOrCancelled}`, en: `Unclaimed: ${detail.problems.unclaimed} · returned/cancelled: ${detail.problems.returnedOrCancelled}`, ar: `بلا مالك: ${detail.problems.unclaimed} · مرتجع/ملغى: ${detail.problems.returnedOrCancelled}`, zh: `无主：${detail.problems.unclaimed} · 退回/取消：${detail.problems.returnedOrCancelled}` })}</p>
            <p className={cn(detail.problems.noPrice + detail.problems.noMeasure > 0 && "font-semibold text-amber-700 dark:text-amber-300")}>
              {L({ ku: `بێ نرخ: ${detail.problems.noPrice} · بێ کێش/قەبارە: ${detail.problems.noMeasure}`, en: `No price: ${detail.problems.noPrice} · no weight/size: ${detail.problems.noMeasure}`, ar: `بلا سعر: ${detail.problems.noPrice} · بلا وزن: ${detail.problems.noMeasure}`, zh: `无价格：${detail.problems.noPrice} · 无重量：${detail.problems.noMeasure}` })}
            </p>
            {detail.receiptDiscountsUsd > 0 && <p>{L({ ku: "داشکانی سەر وەسڵی بۆکسەکان:", en: "Discounts on box receipts:", ar: "خصومات الإيصالات:", zh: "箱子收据折扣：" })} <bdi dir="ltr" className="font-mono">{fmtUsd(detail.receiptDiscountsUsd)}</bdi></p>}
          </div>
          <div className="space-y-1 rounded-xl border bg-card p-3 text-sm">
            <p className="font-semibold">{L({ ku: "قورسترین پاکەتەکان", en: "Heaviest parcels", ar: "أثقل الطرود", zh: "最重包裹" })}</p>
            {detail.heaviest.map((h) => (
              <div key={h.packageId} className="flex items-center justify-between gap-2 text-xs">
                <bdi dir="ltr" className="min-w-0 truncate font-mono">{h.trackingNumber}</bdi>
                <span className="text-muted-foreground"><bdi dir="ltr" className="font-mono">{h.customerCode ?? ""}</bdi></span>
                <span className="font-mono tabular-nums" dir="ltr">{qtyText(h.qty, unit)} · {fmtUsd(h.revenue)}</span>
              </div>
            ))}
          </div>
          {detail.bySource.length > 0 && (
            <div className="space-y-1 rounded-xl border bg-card p-3 text-sm">
              <p className="font-semibold">{L({ ku: "سەرچاوەی کڕین", en: "Where it was bought", ar: "مصدر الشراء", zh: "购买来源" })}</p>
              {detail.bySource.map((s) => (
                <div key={s.platform} className="flex items-center justify-between text-xs"><span className="capitalize">{s.platform}</span><span className="font-mono">{s.parcels}</span></div>
              ))}
            </div>
          )}
          {detail.previous && (
            <div className="space-y-1 rounded-xl border bg-card p-3 text-sm" data-testid="batch-report-previous">
              <p className="font-semibold">{L({ ku: "بەراورد لەگەڵ باچی پێشوو", en: "Against the last batch", ar: "مقارنة بالدفعة السابقة", zh: "与上一批比较" })} <bdi dir="ltr" className="font-mono text-xs">{detail.previous.batchCode}</bdi></p>
              <p className="text-xs">{L({ ku: "قەبارە", en: "Size", ar: "الحجم", zh: "数量" })}: <bdi dir="ltr" className="font-mono">{qtyText(detail.previous.qty, unit)}</bdi></p>
              <p className="text-xs">{L({ ku: "داهات", en: "Revenue", ar: "الإيراد", zh: "收入" })}: <bdi dir="ltr" className="font-mono">{fmtUsd(detail.previous.revenue)}</bdi></p>
              {detail.previous.profit !== null && <p className="text-xs">{L({ ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })}: <bdi dir="ltr" className="font-mono">{signed(detail.previous.profit)}</bdi></p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BatchReportDetailLoading() {
  return <Skeleton className="h-40 w-full rounded-xl" />;
}
