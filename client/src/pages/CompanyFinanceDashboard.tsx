import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowUpLeft, Clock, MessageCircle, Plus, ShieldAlert, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { cn } from "@/lib/utils";
import { DISCOUNT_REASON_LABELS, type DiscountReason } from "@shared/boxSettlement";
import {
  fixedCostMonthlyUsd,
  monthlyNeedUsd,
  type CostCurrency,
  type CostPer,
  type DashboardPeriod,
  type FixedCost,
} from "@shared/financePulse";

type Words = { ku: string; en: string; ar: string; zh: string };

/** A dollar figure that reads left to right inside a Kurdish line. */
function Money({ value, signed, className }: { value: number; signed?: boolean; className?: string }) {
  const sign = value < 0 ? "−" : signed ? "+" : "";
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {sign}{fmtUsd(Math.abs(value))}
    </bdi>
  );
}

/**
 * One line of the dashboard: what it is, how many records are behind it, the
 * figure, and the way to those records. Every figure on this page is one of
 * these — the owner's rule is that nothing here stands without its source.
 */
function Row({ label, note, href, linkWords, children, tone }: {
  label: React.ReactNode;
  note?: React.ReactNode;
  href?: string;
  linkWords?: string;
  children?: React.ReactNode;
  tone?: "good" | "bad" | "quiet";
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <span className="flex min-w-0 flex-wrap items-center gap-x-2">
        <span>{label}</span>
        {note != null && <span className="text-xs text-muted-foreground">{note}</span>}
        {href && (
          <Link href={href} className="text-xs text-primary underline">
            {linkWords}
          </Link>
        )}
      </span>
      {children != null && (
        <span
          className={cn(
            "shrink-0 font-medium",
            tone === "good" && "text-emerald-700 dark:text-emerald-400",
            tone === "bad" && "text-red-700 dark:text-red-400",
            tone === "quiet" && "text-muted-foreground",
          )}
        >
          {children}
        </span>
      )}
    </div>
  );
}

const LEVEL_STYLE = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  watch: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  danger: "border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200",
} as const;

/** The running costs, edited as a short list (main admin only). */
function CostsEditor({ costs, onClose, L }: { costs: FixedCost[]; onClose: () => void; L: (w: Words) => string }) {
  const utils = trpc.useUtils();
  const [rows, setRows] = useState(() => costs.map((c) => ({ ...c, amount: String(c.amount), rate: String(c.rate) })));
  const [fault, setFault] = useState("");
  const save = trpc.ledger.saveFixedCosts.useMutation({
    onSuccess: () => {
      void utils.ledger.financeDashboard.invalidate();
      toast.success(L({ ku: "مەسارفەکان هەڵگیران", en: "Costs saved", ar: "تم حفظ المصاريف", zh: "已保存费用" }));
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => {
    setFault("");
    setRows((list) => list.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  };
  const parsed: FixedCost[] = rows.map((r) => ({
    name: r.name.trim(),
    amount: Number(r.amount),
    currency: r.currency,
    rate: r.currency === "USD" ? 1 : Number(r.rate),
    per: r.per,
  }));
  const submit = () => {
    const bad = parsed.findIndex((c) => !c.name || !(c.amount > 0) || !(c.rate > 0));
    if (bad >= 0) {
      setFault(L({
        ku: `دێڕی ${bad + 1}: ناو، بڕ و نرخی دراو پێویستن`,
        en: `Row ${bad + 1}: a name, an amount and a rate are needed`,
        ar: `الصف ${bad + 1}: الاسم والمبلغ والسعر مطلوبة`,
        zh: `第 ${bad + 1} 行：需要名称、金额和汇率`,
      }));
      return;
    }
    save.mutate({ costs: parsed });
  };

  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="costs-editor">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_7rem_5.5rem_5.5rem_5rem_auto]">
          <Input className="col-span-2 sm:col-span-1" value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder={L({ ku: "کرێی بینا", en: "Rent", ar: "الإيجار", zh: "房租" })} />
          <Input dir="ltr" inputMode="decimal" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} placeholder="1200" />
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={r.currency}
            onChange={(e) => set(i, { currency: e.target.value as CostCurrency, rate: e.target.value === "IQD" ? "1550" : e.target.value === "RMB" ? "7.1" : "1" })}
          >
            <option value="USD">{L({ ku: "دۆلار", en: "USD", ar: "دولار", zh: "美元" })}</option>
            <option value="IQD">{L({ ku: "دینار", en: "IQD", ar: "دينار", zh: "第纳尔" })}</option>
            <option value="RMB">{L({ ku: "ڕمیمبی", en: "RMB", ar: "يوان", zh: "人民币" })}</option>
          </select>
          <Input
            dir="ltr"
            inputMode="decimal"
            value={r.currency === "USD" ? "1" : r.rate}
            disabled={r.currency === "USD"}
            onChange={(e) => set(i, { rate: e.target.value })}
            title={L({ ku: "چەند لەو دراوە بە یەک دۆلار", en: "How many to one dollar", ar: "كم مقابل الدولار", zh: "兑一美元" })}
          />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={r.per} onChange={(e) => set(i, { per: e.target.value as CostPer })}>
            <option value="month">{L({ ku: "مانگانە", en: "a month", ar: "شهرياً", zh: "每月" })}</option>
            <option value="day">{L({ ku: "ڕۆژانە", en: "a day", ar: "يومياً", zh: "每天" })}</option>
          </select>
          <div className="flex items-center justify-between gap-2">
            <Money value={fixedCostMonthlyUsd(parsed[i])} className="text-xs text-muted-foreground" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={L({ ku: "سڕینەوەی دێڕ", en: "Remove row", ar: "حذف الصف", zh: "删除行" })}
              onClick={() => setRows((list) => list.filter((_, n) => n !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      {fault && <p className="text-sm text-red-700 dark:text-red-400">{fault}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={() => setRows((list) => [...list, { name: "", amount: "", currency: "IQD", rate: "1550", per: "month" }])}>
          <Plus className="me-1 h-4 w-4" />
          {L({ ku: "دێڕی نوێ", en: "Add a row", ar: "صف جديد", zh: "新增一行" })}
        </Button>
        <span className="text-sm">
          {L({ ku: "کۆی مانگانە", en: "Monthly total", ar: "المجموع الشهري", zh: "每月合计" })}: <Money value={monthlyNeedUsd(parsed)} className="font-semibold" />
        </span>
        <span className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>{L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</Button>
          <Button type="button" size="sm" onClick={submit} disabled={save.isPending}>{L({ ku: "هەڵگرتن", en: "Save", ar: "حفظ", zh: "保存" })}</Button>
        </span>
      </div>
    </div>
  );
}

/**
 * The finance dashboard (owner, 2026-10-06/07): simple, every figure with the
 * way back to its records, and a warning that foresees a loss from the
 * average of recent days — never from one day.
 */
export default function CompanyFinanceDashboard() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const { user } = useAuth();
  const isMainAdmin = user?.role === "super_admin";
  const search = useSearch();
  const focus = new URLSearchParams(search).get("focus");
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [showDiscounts, setShowDiscounts] = useState(focus === "discounts");
  const [editingCosts, setEditingCosts] = useState(false);
  const { data, isLoading } = trpc.ledger.financeDashboard.useQuery({ period });
  const pulseRef = useRef<HTMLDivElement>(null);

  // Arriving from the bell: the warning is what was clicked, so it is what is shown.
  useEffect(() => {
    if (focus === "pulse" && data) pulseRef.current?.scrollIntoView({ block: "start" });
  }, [focus, data]);

  const see = L({ ku: "بیانبینە", en: "See them", ar: "اعرض", zh: "查看" });
  const periods: Array<[DashboardPeriod, Words]> = [
    ["month", { ku: "ئەم مانگە", en: "This month", ar: "هذا الشهر", zh: "本月" }],
    ["lastMonth", { ku: "مانگی پێشوو", en: "Last month", ar: "الشهر الماضي", zh: "上月" }],
    ["year", { ku: "ئەمساڵ", en: "This year", ar: "هذا العام", zh: "今年" }],
  ];

  const p = data?.pulse;
  const level = p?.pulse.level ?? "ok";
  const waiting = data
    ? [
        { n: data.waiting.boxPaidOwed, icon: TriangleAlert, href: "/finance/box-double-charges", words: { ku: "کڕیار بۆ بۆکسێکی واسڵکراو وەک قەرزار دەردەکەون", en: "customers shown owing for a box they paid", ar: "عملاء يظهرون مدينين بصندوق سدّدوه", zh: "客户因已付款箱子仍显示欠款" } },
        { n: data.waiting.boxesUnpaid, icon: Clock, href: "/customer-delivery-scanner?unpaid=1", words: { ku: "بۆکس دراوەتە دەست و پارەی نەهاتووە", en: "boxes handed over and not paid", ar: "صناديق سُلّمت ولم تُدفع", zh: "箱子已交付未付款" } },
        { n: data.waiting.batchesWithoutCost, icon: TriangleAlert, href: "/batches", words: { ku: "باچی گەیشتوو نرخی تێچوویان نییە", en: "arrived batches have no cost", ar: "شحنات وصلت بلا تكلفة", zh: "已到批次无成本" } },
        { n: data.waiting.unbilledArrived, icon: TriangleAlert, href: "/settings/data-management", words: { ku: "کاڵای گەیشتوو لەسەر کڕیار نەنووسراوە", en: "arrived goods not on the customer's account", ar: "بضائع وصلت لم تُقيَّد على العميل", zh: "已到货物未记账" } },
        { n: data.waiting.oldDebtors, icon: Clock, href: "/finance/debtors", words: { ku: "کڕیار قەرزیان لە 30 ڕۆژ کۆنترە", en: "customers owe for over 30 days", ar: "عملاء ديونهم أقدم من 30 يوماً", zh: "客户欠款超过 30 天" } },
        { n: data.waiting.whatsappUnsent, icon: MessageCircle, href: "/customer-delivery-scanner?whatsapp=unsent", words: { ku: "وەسڵ بە واتسئەپ نەنێردراوە", en: "receipts not sent on WhatsApp", ar: "إيصالات لم تُرسل عبر واتساب", zh: "收据未通过 WhatsApp 发送" } },
      ].filter((w) => w.n > 0)
    : [];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6" data-testid="finance-dashboard">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{L({ ku: "داشبۆردی دارایی", en: "Finance dashboard", ar: "لوحة المالية", zh: "财务面板" })}</h1>
          <div className="grid grid-cols-3 gap-1">
            {periods.map(([key, words]) => (
              <Button key={key} size="sm" variant={period === key ? "default" : "outline"} onClick={() => setPeriod(key)}>
                {L(words)}
              </Button>
            ))}
          </div>
        </div>

        {isLoading || !data || !p ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            {/* 1. The warning — always about now, whatever period is chosen below. */}
            <div ref={pulseRef} className={cn("scroll-mt-20 rounded-lg border p-4", LEVEL_STYLE[level])} data-testid="finance-pulse">
              <div className="flex items-start gap-2">
                {level === "ok" ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {level === "ok"
                      ? L({ ku: "کار مەسارف دادەپۆشێت", en: "The work covers its costs", ar: "العمل يغطي مصاريفه", zh: "业务可覆盖费用" })
                      : p.pulse.reason === "month-loss"
                        ? L({ ku: "مەترسیی زەرەر: پێشبینیی ئەم مانگە لە مەسارف کەمترە", en: "Loss ahead: this month is forecast short of its costs", ar: "خطر خسارة: المتوقع أقل من المصاريف", zh: "亏损预警：本月预计不足以覆盖费用" })
                        : p.pulse.reason === "fortnight-slow"
                          ? L({ ku: "مەترسی: دوو هەفتەیە قازانج لە پێویست کەمترە", en: "Danger: two weeks of profit below what is needed", ar: "خطر: أسبوعان والربح أقل من المطلوب", zh: "危险：两周利润低于所需" })
                          : L({ ku: "ئاگاداری: ئەم هەفتەیە سست بوو", en: "Watch: a slow week", ar: "تنبيه: أسبوع بطيء", zh: "注意：本周较慢" })}
                  </div>
                  <p className="text-sm opacity-90">
                    {L({
                      ku: "بە تێکڕای ڕۆژان ژمێردراوە، نەک یەک ڕۆژ — بازاڕ هەموو ڕۆژێک وەک یەک نییە.",
                      en: "Counted on averages, never one day — the market is not the same every day.",
                      ar: "محسوب على المتوسط لا على يوم واحد.",
                      zh: "按平均值计算，而非单日。",
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {([
                  [{ ku: "پێویستی ڕۆژانە", en: "Needed a day", ar: "المطلوب يومياً", zh: "每日所需" }, p.pulse.needDailyUsd, false],
                  [{ ku: "تێکڕای 7 ڕۆژ", en: "7-day average", ar: "متوسط 7 أيام", zh: "7 日均" }, p.pulse.avg7Usd, true],
                  [{ ku: "تێکڕای 30 ڕۆژ", en: "30-day average", ar: "متوسط 30 يوماً", zh: "30 日均" }, p.pulse.avg30Usd, true],
                  [{ ku: "پێشبینیی کۆتایی مانگ", en: "Month forecast", ar: "توقع نهاية الشهر", zh: "月末预测" }, p.pulse.forecastResultUsd, true],
                ] as Array<[Words, number, boolean]>).map(([words, value, judged], i) => (
                  <div key={i} className="rounded-md bg-background/60 p-2 text-foreground">
                    <div className="text-xs text-muted-foreground">{L(words)}</div>
                    <Money
                      value={value}
                      signed={i === 3}
                      className={cn("text-base font-semibold", judged && (i === 3 ? value < 0 : value < p.pulse.needDailyUsd) && "text-red-700 dark:text-red-400")}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {p.orders.slow && (
                  <div>
                    {L({
                      ku: `ئۆردەر کەم بووەتەوە: ئەم هەفتەیە ${p.orders.thisWeek}، هەفتەی پێشوو ${p.orders.lastWeek}، هەفتەی ئاسایی ${p.orders.usualWeek}.`,
                      en: `Orders are slowing: ${p.orders.thisWeek} this week, ${p.orders.lastWeek} last week, ${p.orders.usualWeek} in a usual week.`,
                      ar: `الطلبات تتراجع: ${p.orders.thisWeek} هذا الأسبوع، المعتاد ${p.orders.usualWeek}.`,
                      zh: `订单减少：本周 ${p.orders.thisWeek}，平时 ${p.orders.usualWeek}。`,
                    })}{" "}
                    <Link href="/commission-orders" className="underline">{see}</Link>
                  </div>
                )}
                {p.draws.eatingCapital && (
                  <div>
                    {L({ ku: "بردنی شەریکەکان لە 30 ڕۆژدا", en: "Partners took out in 30 days", ar: "سحوبات الشركاء في 30 يوماً", zh: "合伙人 30 天提款" })}{" "}
                    <Money value={p.draws.totalLast30Usd} className="font-semibold" />{" "}
                    {L({ ku: "— قازانجی پاک", en: "— net profit", ar: "— صافي الربح", zh: "— 净利润" })}{" "}
                    <Money value={p.draws.netProfit30Usd} className="font-semibold" />.{" "}
                    <Money value={p.draws.fromCapitalUsd} className="font-semibold" />{" "}
                    {L({ ku: "لە سەرمایە ڕۆیشتووە.", en: "came out of capital.", ar: "خرج من رأس المال.", zh: "出自本金。" })}{" "}
                    <Link href="/company/partners" className="underline">{see}</Link>
                  </div>
                )}
                {p.draws.spikes.map((s) => (
                  <div key={s.name}>
                    {L({ ku: `${s.name} ئەم مانگە زیاتر لە ئاسایی بردوویەتی:`, en: `${s.name} took more than usual this month:`, ar: `${s.name} سحب أكثر من المعتاد:`, zh: `${s.name} 本月提款高于平时：` })}{" "}
                    <Money value={s.last30Usd} className="font-semibold" /> {L({ ku: "— ئاسایی", en: "— usual", ar: "— المعتاد", zh: "— 平时" })} <Money value={s.usualMonthUsd} />.{" "}
                    <Link href="/company/partners" className="underline">{see}</Link>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Three figures. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                ["/payments", { ku: "پارەی هاتوو", en: "Money received", ar: "المبالغ المستلمة", zh: "已收款" }, data.received.usd, L({ ku: `${data.received.count} وەسڵ`, en: `${data.received.count} receipts`, ar: `${data.received.count} إيصال`, zh: `${data.received.count} 张` }), false],
                ["/reports/monthly-profit", { ku: "قازانجی پاک", en: "Net profit", ar: "صافي الربح", zh: "净利润" }, data.profit.netUsd, L({ ku: "دوای مەسارف", en: "after expenses", ar: "بعد المصاريف", zh: "扣除费用后" }), true],
                ["/finance/debtors", { ku: "قەرزی کڕیاران", en: "Customers owe", ar: "ديون العملاء", zh: "客户欠款" }, data.debt.usd, L({ ku: `${data.debt.debtors} کڕیار · ئێستا`, en: `${data.debt.debtors} customers · now`, ar: `${data.debt.debtors} عميل · الآن`, zh: `${data.debt.debtors} 位客户 · 现在` }), false],
              ] as Array<[string, Words, number, string, boolean]>).map(([href, words, value, note, signed]) => (
                <Link key={href} href={href} className="block rounded-lg bg-muted/50 p-4 hover:bg-muted">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {L(words)} <ArrowUpLeft className="h-3 w-3" />
                  </div>
                  <div className={cn("text-2xl font-semibold", signed && (value < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"))}>
                    <Money value={value} signed={signed} />
                  </div>
                  <div className="text-xs text-muted-foreground">{note}</div>
                </Link>
              ))}
            </div>

            {/* 3. Profit and loss. */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{L({ ku: "قازانج و زەرەر", en: "Profit and loss", ar: "الأرباح والخسائر", zh: "损益" })}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <Row
                  tone={data.profit.freightUsd < 0 ? "bad" : "good"}
                  label={L({ ku: "قازانجی شەحن", en: "Freight profit", ar: "ربح الشحن", zh: "运费利润" })}
                  note={L({ ku: `${data.profit.parcels} پاکەت`, en: `${data.profit.parcels} parcels`, ar: `${data.profit.parcels} طرد`, zh: `${data.profit.parcels} 件` })}
                  href="/reports/batches"
                  linkWords={L({ ku: "باچەکان", en: "Batches", ar: "الشحنات", zh: "批次" })}
                >
                  <Money value={data.profit.freightUsd} signed />
                </Row>
                <Row
                  tone={data.profit.ordersUsd < 0 ? "bad" : "good"}
                  label={L({ ku: "قازانجی کڕین", en: "Buying profit", ar: "ربح الشراء", zh: "代购利润" })}
                  note={L({ ku: `${data.profit.orders} داواکاری`, en: `${data.profit.orders} orders`, ar: `${data.profit.orders} طلب`, zh: `${data.profit.orders} 单` })}
                  href="/reports/monthly-profit"
                  linkWords={L({ ku: "ڕاپۆرتی قازانج", en: "Profit report", ar: "تقرير الأرباح", zh: "利润报表" })}
                >
                  <Money value={data.profit.ordersUsd} signed />
                </Row>
                {data.profit.stockUsd !== 0 && (
                  <Row
                    tone={data.profit.stockUsd < 0 ? "bad" : "good"}
                    label={L({ ku: "کاڵای ڕەتکراوە", en: "Refused goods", ar: "بضائع مرفوضة", zh: "拒收货物" })}
                    note={L({ ku: "تێچوویان خەسارەیە؛ فرۆشتن و قەرەبوو لێی کەم دەکاتەوە", en: "their cost is a loss; sales and kept money come off it", ar: "تكلفتها خسارة؛ البيع والتعويض يخففانها", zh: "成本计为亏损；售出与保留款冲减" })}
                    href="/finance/company-stock"
                    linkWords={L({ ku: "کاڵای ماوە", en: "Company stock", ar: "مخزون الشركة", zh: "公司库存" })}
                  >
                    <Money value={data.profit.stockUsd} signed />
                  </Row>
                )}
                <Row
                  tone="bad"
                  label={L({ ku: "مەسارف", en: "Expenses", ar: "المصاريف", zh: "费用" })}
                  note={L({ ku: `${data.profit.expenseCount} دێڕ`, en: `${data.profit.expenseCount} lines`, ar: `${data.profit.expenseCount} بند`, zh: `${data.profit.expenseCount} 笔` })}
                  href="/company/expenses"
                  linkWords={L({ ku: "خەرجییەکان", en: "Expenses", ar: "المصاريف", zh: "费用" })}
                >
                  <Money value={-data.profit.expensesUsd} />
                </Row>
                <div className="flex items-center justify-between gap-3 border-t py-2 font-semibold">
                  <span>{L({ ku: "قازانجی پاک", en: "Net profit", ar: "صافي الربح", zh: "净利润" })}</span>
                  <Money value={data.profit.netUsd} signed className={data.profit.netUsd < 0 ? "text-red-700 dark:text-red-400" : undefined} />
                </div>

                {/* Told, not subtracted: a discount is not an expense (owner, 2026-10-07). */}
                <div className="mt-1 border-t pt-1 text-muted-foreground">
                  <div className="flex items-center justify-between gap-3 py-1.5">
                    <span className="flex flex-wrap items-center gap-x-2">
                      {L({ ku: "داشکانی دراو", en: "Discounts given", ar: "الخصومات الممنوحة", zh: "已给折扣" })}
                      <span className="text-xs">{L({ ku: `${data.discounts.count} جار`, en: `${data.discounts.count} times`, ar: `${data.discounts.count} مرة`, zh: `${data.discounts.count} 次` })}</span>
                      {data.discounts.count > 0 && (
                        <button type="button" className="text-xs text-primary underline" onClick={() => setShowDiscounts((v) => !v)}>
                          {showDiscounts ? L({ ku: "داخستن", en: "Hide", ar: "إخفاء", zh: "收起" }) : L({ ku: "بۆ کێ و بۆچی", en: "To whom and why", ar: "لمن ولماذا", zh: "给谁、为何" })}
                        </button>
                      )}
                    </span>
                    <Money value={data.discounts.usd} />
                  </div>
                  {showDiscounts && (
                    <ul className="mb-2 divide-y rounded-md border text-foreground" data-testid="discount-list">
                      {data.discounts.list.map((d) => (
                        <li key={d.lineId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                          <span className="min-w-0 flex-1">
                            <Link href={`/finance/customer/${d.customerId}`} className="font-medium underline">{d.customerName ?? d.customerCode}</Link>
                            <span className="block text-xs text-muted-foreground">
                              <bdi dir="ltr">{new Date(d.at).toLocaleDateString("en-GB")}</bdi> ·{" "}
                              <Link href={`/customer-delivery-scanner?box=${d.boxId}`} className="underline"><bdi dir="ltr">{d.boxCode ?? d.settlementNumber}</bdi></Link>
                              {d.by ? <> · {d.by}</> : null}
                            </span>
                            <span className="block text-xs">
                              {d.reason ? L(DISCOUNT_REASON_LABELS[d.reason as DiscountReason] ?? { ku: d.reason, en: d.reason, ar: d.reason, zh: d.reason }) : L({ ku: "هۆکار نەنووسراوە", en: "No reason written", ar: "بلا سبب", zh: "未写原因" })}
                              {d.note ? ` — ${d.note}` : ""}
                            </span>
                          </span>
                          <Money value={d.usd} className="font-medium" />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between gap-3 py-1.5">
                    <span className="flex flex-wrap items-center gap-x-2">
                      {L({ ku: "بردنی شەریکەکان", en: "Partners took out", ar: "سحوبات الشركاء", zh: "合伙人提款" })}
                      <Link href="/company/partners" className="text-xs text-primary underline">{L({ ku: "هاوبەشەکان", en: "Partners", ar: "الشركاء", zh: "合伙人" })}</Link>
                    </span>
                    <Money value={data.partnersTookOutUsd} />
                  </div>
                </div>

                {data.lossBatches.length > 0 && (
                  <div className="mt-2 rounded-md border border-red-300 p-2 dark:border-red-500/40">
                    <div className="mb-1 text-xs text-red-700 dark:text-red-400">{L({ ku: "باچی زەرەرمەند", en: "Batches that lost money", ar: "شحنات خاسرة", zh: "亏损批次" })}</div>
                    {data.lossBatches.map((b) => (
                      <Row key={b.batchId} tone="bad" label={<bdi dir="ltr">{b.code}</bdi>} href={`/batches/${b.batchId}/financial`} linkWords={L({ ku: "بیکەوە", en: "Open", ar: "افتح", zh: "打开" })}>
                        <Money value={-b.lossUsd} />
                      </Row>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 4. The running costs the warning is measured against. */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">{L({ ku: "مەسارفی جێگیری مانگانە", en: "Monthly running costs", ar: "المصاريف الثابتة الشهرية", zh: "每月固定费用" })}</CardTitle>
                {isMainAdmin && !editingCosts && (
                  <Button variant="outline" size="sm" onClick={() => setEditingCosts(true)}>{L({ ku: "دەستکاری", en: "Edit", ar: "تعديل", zh: "编辑" })}</Button>
                )}
              </CardHeader>
              <CardContent className="text-sm">
                {editingCosts ? (
                  <CostsEditor costs={p.costs} onClose={() => setEditingCosts(false)} L={L} />
                ) : (
                  <>
                    {p.costs.map((c, i) => (
                      <Row
                        key={i}
                        label={c.name}
                        note={<bdi dir="ltr">{c.amount.toLocaleString("en-US")} {c.currency}{c.per === "day" ? " × 30" : ""}</bdi>}
                      >
                        <Money value={fixedCostMonthlyUsd(c)} />
                      </Row>
                    ))}
                    <div className="flex items-center justify-between gap-3 border-t py-2 font-semibold">
                      <span>{L({ ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })}</span>
                      <Money value={p.needMonthlyUsd} />
                    </div>
                    <Row
                      tone="quiet"
                      label={L({ ku: "تێکڕای ڕاستەقینەی سێ مانگی ڕابردوو", en: "Real average of the last three months", ar: "المتوسط الفعلي لآخر ثلاثة أشهر", zh: "近三个月实际平均" })}
                      href="/company/expenses"
                      linkWords={see}
                    >
                      <Money value={p.actualMonthlyUsd} />
                    </Row>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 5. Where the money is — the main admin's alone. */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">{L({ ku: "پارەی شەریکە لە کوێیە", en: "Where the money is", ar: "أين المال", zh: "资金所在" })}</CardTitle>
                {data.capital && (
                  <Link href="/finance/working-capital" className="text-xs text-primary underline">{L({ ku: "سەرمایەی کار", en: "Working capital", ar: "رأس المال العامل", zh: "营运资金" })}</Link>
                )}
              </CardHeader>
              <CardContent className="text-sm">
                <Row
                  label={L({ ku: "لای کڕیاران", en: "With customers", ar: "عند العملاء", zh: "客户欠款" })}
                  note={L({ ku: `${data.debt.debtors} کڕیار`, en: `${data.debt.debtors} customers`, ar: `${data.debt.debtors} عميل`, zh: `${data.debt.debtors} 位` })}
                  href="/finance/debtors"
                  linkWords={see}
                >
                  <Money value={data.debt.usd} />
                </Row>
                <Row
                  tone={data.debt.old.usd > 0 ? "bad" : "quiet"}
                  label={L({ ku: "لەوە، زیاتر لە 30 ڕۆژە گیری خواردووە", en: "Of that, stuck for over 30 days", ar: "منها، عالق منذ أكثر من 30 يوماً", zh: "其中超过 30 天" })}
                  note={L({ ku: `${data.debt.old.count} کڕیار`, en: `${data.debt.old.count} customers`, ar: `${data.debt.old.count} عميل`, zh: `${data.debt.old.count} 位` })}
                  href="/finance/debtors"
                  linkWords={see}
                >
                  <Money value={data.debt.old.usd} />
                </Row>
                {data.debt.top.map((t) => (
                  <Row
                    key={t.customerId}
                    tone="quiet"
                    label={t.name ?? t.code}
                    note={L({ ku: `${t.sharePct}٪ی هەموو قەرز`, en: `${t.sharePct}% of all debt`, ar: `${t.sharePct}% من الديون`, zh: `占欠款 ${t.sharePct}%` })}
                    href={`/finance/customer/${t.customerId}`}
                    linkWords={L({ ku: "حیسابەکەی", en: "Account", ar: "الحساب", zh: "账户" })}
                  >
                    <Money value={t.usd} />
                  </Row>
                ))}
                {data.capital && (
                  <>
                    <Row label={L({ ku: "کاڵای ڕێگا", en: "Goods on the road", ar: "بضائع في الطريق", zh: "在途货物" })} href="/finance/goods-on-road" linkWords={see}>
                      <Money value={data.capital.goodsOnRoadUsd} />
                    </Row>
                    {data.capital.stockCount > 0 && (
                      <Row tone="bad" label={L({ ku: "کاڵای خەسارە (لە کۆکەدا نییە)", en: "Loss goods (not in the total)", ar: "بضائع خاسرة (خارج المجموع)", zh: "亏损货物（不计入合计）" })} note={L({ ku: `${data.capital.stockCount} دانە`, en: `${data.capital.stockCount}`, ar: `${data.capital.stockCount}`, zh: `${data.capital.stockCount}` })} href="/finance/company-stock" linkWords={see}>
                        <Money value={data.capital.stockUsd} />
                      </Row>
                    )}
                    <Row
                      tone={data.capital.netCashUsd < 0 ? "bad" : undefined}
                      label={L({ ku: "نەقدی پاک", en: "Net cash", ar: "صافي النقد", zh: "净现金" })}
                      note={data.capital.cashDays != null
                        ? L({ ku: `بەشی ${data.capital.cashDays} ڕۆژی مەسارف دەکات`, en: `covers ${data.capital.cashDays} days of costs`, ar: `يغطي ${data.capital.cashDays} يوماً`, zh: `可支付 ${data.capital.cashDays} 天` })
                        : undefined}
                      href="/finance/working-capital"
                      linkWords={see}
                    >
                      <Money value={data.capital.netCashUsd} />
                    </Row>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 6. What is waiting for someone. */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{L({ ku: "چاوەڕێی تۆن", en: "Waiting for you", ar: "بانتظارك", zh: "待你处理" })}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {waiting.length === 0 ? (
                  <p className="py-2 text-muted-foreground">{L({ ku: "هیچ شتێک چاوەڕێ نییە.", en: "Nothing is waiting.", ar: "لا شيء بانتظارك.", zh: "没有待办。" })}</p>
                ) : (
                  waiting.map((w) => (
                    <Row
                      key={w.href}
                      label={
                        <span className="flex items-center gap-2">
                          <w.icon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span><bdi dir="ltr">{w.n}</bdi> {L(w.words)}</span>
                        </span>
                      }
                      href={w.href}
                      linkWords={L({ ku: "بیانکەوە", en: "Open", ar: "افتح", zh: "打开" })}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
