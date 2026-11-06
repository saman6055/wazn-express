import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pickLang } from "@/lib/lang";

/**
 * The finance centre's infographics (owner, 2026-11-07): six months of money
 * in, money spent and clean profit side by side, and where this period's
 * money came in. Every figure is one the cards already show
 * (ledger.financeTrend reads the cards' own functions), so a bar and a card
 * never disagree. Colour has one meaning everywhere: cash emerald, spending
 * coral, profit cyan.
 */
type Words = { ku: string; en: string; ar: string; zh: string };
export type TrendRow = { month: string; current: boolean; receivedUsd: number; expensesUsd: number; workProfitUsd: number; netUsd: number };

const CASH = "#10B981";
const SPEND = "#F43F5E";
const PROFIT = "#06B6D4";
const METHOD_COLOURS: Record<string, string> = { CASH: "#10B981", FIB: "#22D3EE", CARD: "#A78BFA" };

const MONTHS_KU = ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"];
const MONTHS_AR = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];

const money = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
const exact = (n: number) => `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function monthLabel(month: string, language: string): string {
  const m = Number(month.slice(5, 7)) - 1;
  if (!(m >= 0 && m < 12)) return month;
  if (language === "ku") return MONTHS_KU[m];
  if (language === "ar") return MONTHS_AR[m];
  return new Date(Date.UTC(2000, m, 1)).toLocaleString(language === "zh" ? "zh-CN" : "en-US", { month: "short", timeZone: "UTC" });
}

/** A tiny line for a card: the shape of the last months, nothing more. */
export function Sparkline({ values, colour = "currentColor" }: { values: number[]; colour?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${20 - ((v - min) / span) * 16}`).join(" ");
  const last = values[values.length - 1];
  const lastY = 20 - ((last - min) / span) * 16;
  return (
    <svg viewBox="0 0 100 22" preserveAspectRatio="none" className="mt-1 h-6 w-full" aria-hidden="true">
      <polyline fill="none" stroke={colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts} vectorEffect="non-scaling-stroke" />
      <circle cx="100" cy={lastY} r="2.4" fill={colour} />
    </svg>
  );
}

export function FinanceTrendCard({ rows, byMethod, language }: {
  rows: TrendRow[];
  byMethod: Array<{ method: string; usd: number; count: number }>;
  language: string;
}) {
  const L = (w: Words) => pickLang(language, w);
  const data = rows.map((r) => ({ ...r, label: monthLabel(r.month, language) }));
  const methodName = (m: string) => (m === "CASH" ? L({ ku: "کاش", en: "Cash", ar: "نقد", zh: "现金" }) : m === "CARD" ? "Qi Card" : m === "FIB" ? "FIB" : L({ ku: "تر", en: "Other", ar: "أخرى", zh: "其他" }));
  const pie = byMethod.filter((m) => m.usd > 0).map((m) => ({ name: methodName(m.method), value: m.usd, colour: METHOD_COLOURS[m.method] ?? "#94A3B8" }));
  const pieTotal = pie.reduce((t, p) => t + p.value, 0);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="finance-trend">
      <div className="rounded-2xl border bg-card p-4 lg:col-span-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{L({ ku: "شەش مانگی ڕابردوو", en: "The last six months", ar: "الأشهر الستة الأخيرة", zh: "近六个月" })}</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CASH }} />{L({ ku: "پارەی هاتوو", en: "Money in", ar: "المقبوض", zh: "收款" })}</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SPEND }} />{L({ ku: "مەسارف", en: "Expenses", ar: "المصاريف", zh: "费用" })}</span>
            <span className="flex items-center gap-1"><span className="h-0.5 w-4 rounded" style={{ background: PROFIT }} />{L({ ku: "قازانجی خاوێن", en: "Clean profit", ar: "صافي الربح", zh: "净利润" })}</span>
          </div>
        </div>
        <div className="h-56 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={money} tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.08)" }}
                contentStyle={{ borderRadius: 12, fontSize: 12, direction: language === "ku" || language === "ar" ? "rtl" : "ltr" }}
                formatter={(value: number, key: string) => [exact(value), key === "receivedUsd" ? L({ ku: "پارەی هاتوو", en: "Money in", ar: "المقبوض", zh: "收款" }) : key === "expensesUsd" ? L({ ku: "مەسارف", en: "Expenses", ar: "المصاريف", zh: "费用" }) : L({ ku: "قازانجی خاوێن", en: "Clean profit", ar: "صافي الربح", zh: "净利润" })]}
              />
              <Bar dataKey="receivedUsd" fill={CASH} radius={[6, 6, 0, 0]} maxBarSize={26} />
              <Bar dataKey="expensesUsd" fill={SPEND} radius={[6, 6, 0, 0]} maxBarSize={26} />
              <Line dataKey="netUsd" stroke={PROFIT} strokeWidth={2.5} dot={{ r: 3, fill: PROFIT }} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{L({ ku: "مانگی ئەمڕۆ تا ئێستا دەژمێردرێت. هەمان ژمارەی کارتەکانن.", en: "This month counts up to now. The same figures as the cards.", ar: "الشهر الحالي حتى الآن. نفس أرقام البطاقات.", zh: "本月截至现在，与卡片数字一致。" })}</p>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">{L({ ku: "پارە لە کوێ هات", en: "Where the money came in", ar: "أين وصل المال", zh: "收款渠道" })}</p>
        {pieTotal > 0 ? (
          <>
            <div className="relative h-40" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none">
                    {pie.map((p) => <Cell key={p.name} fill={p.colour} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => exact(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-sm font-bold tabular-nums">{money(pieTotal)}</span>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {pie.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.colour }} />{p.name}</span>
                  <span className="font-mono tabular-nums" dir="ltr">{exact(p.value)} · {Math.round((p.value / pieTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground">{L({ ku: "لەم ماوەیەدا پارە نەهاتووە", en: "No money in this period", ar: "لا مقبوضات في هذه الفترة", zh: "本期无收款" })}</p>
        )}
      </div>
    </div>
  );
}
