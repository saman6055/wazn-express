import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartEmpty } from "@/components/dashboard";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { PlatformChip } from "@/components/PlatformChip";
import { platformColor } from "@/components/PlatformSelect";
import { ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

/**
 * Where the buying actually happens — orders per shop (Taobao, 1688, …).
 *
 * Answers "which platform do we buy from most", so the owner can see where the
 * volume and the money concentrate. Orders with no platform recorded are kept
 * as their own row rather than dropped, so the totals still reconcile with the
 * order lists.
 */
export function PlatformBreakdownSection({
  startDate,
  endDate,
}: {
  startDate: Date;
  endDate: Date;
}) {
  const { language } = useTranslation();

  const { data, isLoading } = trpc.reports.ordersByPlatform.useQuery({ startDate, endDate });

  const noneLabel = pickLang(language, {
    ku: "بێ پلاتفۆرم", en: "Not recorded", ar: "غير مسجّل", zh: "未记录",
  });

  const rows = useMemo(() => (data ?? []).map((r) => ({
    ...r,
    name: r.platform ?? noneLabel,
    color: r.platform ? platformColor(r.platform) : "#94a3b8",
  })), [data, noneLabel]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      orders: acc.orders + r.orders,
      units: acc.units + r.units,
      value: acc.value + r.value,
      profit: acc.profit + r.profit,
    }),
    { orders: 0, units: 0, value: 0, profit: 0 },
  ), [rows]);

  const money = (n: number) => `$${n.toFixed(2)}`;
  const share = (n: number) => (totals.orders > 0 ? Math.round((n / totals.orders) * 100) : 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingBag className="h-5 w-5 text-amber-600 dark:text-amber-300" />
          {pickLang(language, {
            ku: "کڕین بەپێی پلاتفۆرم",
            en: "Purchases by platform",
            ar: "المشتريات حسب المنصة",
            zh: "按平台的采购",
          })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <ChartContainer><div className="h-64 animate-pulse rounded-lg bg-muted/50" /></ChartContainer>
        ) : rows.length === 0 ? (
          <ChartEmpty message={pickLang(language, {
            ku: "هیچ ئۆردەرێک لەم ماوەیەدا نییە",
            en: "No orders in this period",
            ar: "لا توجد طلبات في هذه الفترة",
            zh: "该期间没有订单",
          })} />
        ) : (
          <>
            <ChartContainer>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: number, key: string) =>
                      key === "orders" ? [v, pickLang(language, { ku: "ئۆردەر", en: "Orders", ar: "طلبات", zh: "订单" })] : [v, key]
                    }
                  />
                  <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                    {rows.map((r) => <Cell key={r.name} fill={r.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-start font-medium">{pickLang(language, { ku: "پلاتفۆرم", en: "Platform", ar: "المنصة", zh: "平台" })}</th>
                    <th className="py-2 text-end font-medium">{pickLang(language, { ku: "ئۆردەر", en: "Orders", ar: "طلبات", zh: "订单" })}</th>
                    <th className="py-2 text-end font-medium">{pickLang(language, { ku: "دانە", en: "Units", ar: "قطع", zh: "件数" })}</th>
                    <th className="py-2 text-end font-medium">{pickLang(language, { ku: "بەها", en: "Value", ar: "القيمة", zh: "金额" })}</th>
                    <th className="py-2 text-end font-medium">{pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })}</th>
                    <th className="py-2 text-end font-medium">{pickLang(language, { ku: "ڕێژە", en: "Share", ar: "الحصة", zh: "占比" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className="border-b last:border-0">
                      <td className="py-2">
                        {r.platform
                          ? <PlatformChip platform={r.platform} />
                          : <span className="text-muted-foreground">{noneLabel}</span>}
                      </td>
                      <td className="py-2 text-end font-medium tabular-nums">{r.orders}</td>
                      <td className="py-2 text-end tabular-nums text-muted-foreground">{r.units}</td>
                      <td className="py-2 text-end tabular-nums">{money(r.value)}</td>
                      <td className="py-2 text-end tabular-nums text-emerald-600 dark:text-emerald-300">{money(r.profit)}</td>
                      <td className="py-2 text-end tabular-nums text-muted-foreground">{share(r.orders)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-2">{pickLang(language, { ku: "کۆی گشتی", en: "Total", ar: "الإجمالي", zh: "合计" })}</td>
                    <td className="py-2 text-end tabular-nums">{totals.orders}</td>
                    <td className="py-2 text-end tabular-nums">{totals.units}</td>
                    <td className="py-2 text-end tabular-nums">{money(totals.value)}</td>
                    <td className="py-2 text-end tabular-nums text-emerald-600 dark:text-emerald-300">{money(totals.profit)}</td>
                    <td className="py-2 text-end tabular-nums">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
