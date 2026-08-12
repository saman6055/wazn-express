import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { ShippingRouteFilter, useShippingRouteFilter } from "@/components/ShippingRouteFilter";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  DollarSign,
  TrendingUp,
  Plane,
  Ship,
  Crown,
  ShoppingBag,
} from "lucide-react";

// Self orders are pure shipping jobs the customer arranged themselves, so they
// only ever carry a shipping type — never a commission/full-package wrapper.
type LangText = { ku: string; en: string; ar: string; zh: string };

const SHIP_LABEL: Record<string, LangText> = {
  air_regular: { ku: "ئاسمانی ئاسایی", en: "Air — Regular", ar: "جوي — عادي", zh: "空运—普通" },
  air_irregular: { ku: "ئاسمانی نائاسایی", en: "Air — Irregular", ar: "جوي — غير عادي", zh: "空运—特殊" },
  sea: { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" },
};

const STATUS_LABEL: Record<string, LangText> = {
  registered: { ku: "تۆمارکراو", en: "Registered", ar: "مُسجّل", zh: "已登记" },
  in_batch: { ku: "لە باچدا", en: "In Batch", ar: "في الدفعة", zh: "在批次中" },
  in_transit: { ku: "لە ڕێگادا", en: "In Transit", ar: "في الطريق", zh: "运输中" },
  customs_processing: { ku: "گومرگ", en: "Customs", ar: "الجمارك", zh: "海关处理" },
  ready_for_delivery: { ku: "ئامادەی گەیاندن", en: "Ready for Delivery", ar: "جاهز للتسليم", zh: "待派送" },
  out_for_delivery: { ku: "لە گەیاندندا", en: "Out for Delivery", ar: "قيد التوصيل", zh: "派送中" },
  delivered: { ku: "گەیەنرا", en: "Delivered", ar: "تم التسليم", zh: "已送达" },
  returned: { ku: "گەڕێنراوە", en: "Returned", ar: "مُرتجَع", zh: "已退回" },
  cancelled: { ku: "هەڵوەشێنرا", en: "Cancelled", ar: "مُلغى", zh: "已取消" },
};

function money(n: number | undefined) {
  return `$${(n ?? 0).toFixed(2)}`;
}

export default function SelfOrders() {
  const { t, language } = useTranslation();
  const [days, setDays] = useState<string>("all");
  const { data, isLoading } = trpc.reports.selfOrderReport.useQuery({
    days: days === "all" ? undefined : Number(days),
  });
  const s = data?.summary;
  const allRecent = data?.recent ?? [];
  const {
    route: routeFilter,
    setRoute: setRouteFilter,
    counts: routeCounts,
    filtered: recent,
  } = useShippingRouteFilter(allRecent, (r: any) => r.shippingType);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t("nav.selfOrders") || pickLang(language, { ku: "سێلف ئۆردەر", en: "Self Orders", ar: "الطلبات الذاتية", zh: "自助订单" })}</h1>
              <p className="text-sm text-muted-foreground">
                {pickLang(language, { ku: "پاکێجی خۆکڕاو — کڕیار خۆی کڕیویەتی، ئێمە تەنها گواستنەوەمان بۆ کردووە", en: "Self-purchased packages — the customer bought it themselves, we only handle shipping", ar: "طرود اشتراها العميل بنفسه — نحن نتولى الشحن فقط", zh: "客户自行购买的包裹——我们仅负责运输" })}
              </p>
            </div>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{pickLang(language, { ku: "٧ ڕۆژی ڕابردوو", en: "Last 7 days", ar: "آخر ٧ أيام", zh: "近 7 天" })}</SelectItem>
              <SelectItem value="30">{pickLang(language, { ku: "٣٠ ڕۆژی ڕابردوو", en: "Last 30 days", ar: "آخر ٣٠ يومًا", zh: "近 30 天" })}</SelectItem>
              <SelectItem value="90">{pickLang(language, { ku: "٩٠ ڕۆژی ڕابردوو", en: "Last 90 days", ar: "آخر ٩٠ يومًا", zh: "近 90 天" })}</SelectItem>
              <SelectItem value="all">{pickLang(language, { ku: "هەمووی", en: "All", ar: "الكل", zh: "全部" })}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "کۆی سێلف ئۆردەر", en: "Total Self Orders", ar: "إجمالي الطلبات الذاتية", zh: "自助订单总数" })}</p>
                <p className="text-2xl font-bold">{isLoading ? "…" : s?.count ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <DollarSign className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "داهاتی گواستنەوە", en: "Shipping Revenue", ar: "إيرادات الشحن", zh: "运输收入" })}</p>
                <p className="text-2xl font-bold">{isLoading ? "…" : money(s?.revenueUsd)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })}</p>
                <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{isLoading ? "…" : money(s?.profitUsd)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Crown className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "باشترین کڕیار", en: "Top Customer", ar: "أفضل عميل", zh: "最佳客户" })}</p>
                <p className="truncate text-base font-bold">
                  {s?.topCustomers?.[0]?.name || s?.topCustomers?.[0]?.code || "—"}
                </p>
                {s?.topCustomers?.[0] && (
                  <p className="text-xs text-muted-foreground">{s.topCustomers[0].count} {pickLang(language, { ku: "پاکێج", en: "packages", ar: "طرود", zh: "件包裹" })} · {money(s.topCustomers[0].revenueUsd)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* By shipping type + top customers */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold">{pickLang(language, { ku: "بەپێی شێوازی گواستنەوە", en: "By Shipping Type", ar: "حسب نوع الشحن", zh: "按运输方式" })}</h3>
              <div className="space-y-2">
                {(["air_regular", "air_irregular", "sea"] as const).map((tp) => {
                  const row = s?.byType?.[tp];
                  const Icon = tp === "sea" ? Ship : Plane;
                  return (
                    <div key={tp} className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${tp === "sea" ? "text-cyan-500 dark:text-cyan-400" : tp === "air_irregular" ? "text-purple-500 dark:text-purple-400" : "text-blue-500 dark:text-blue-400"}`} />
                        <span className="text-sm">{pickLang(language, SHIP_LABEL[tp])}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{row?.count ?? 0} {pickLang(language, { ku: "پاکێج", en: "packages", ar: "طرود", zh: "件包裹" })}</span>
                        <span className="font-mono font-semibold">{money(row?.revenueUsd)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold">{pickLang(language, { ku: "باشترین کڕیارەکانی سێلف ئۆردەر", en: "Top Self-Order Customers", ar: "أفضل عملاء الطلبات الذاتية", zh: "自助订单最佳客户" })}</h3>
              {s?.topCustomers?.length ? (
                <div className="space-y-2">
                  {s.topCustomers.map((c, i) => (
                    <div key={c.customerId} className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                        <span className="truncate text-sm font-medium">{c.name || c.code}</span>
                        <span className="text-xs text-muted-foreground">{c.code}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{c.count} {pickLang(language, { ku: "پاکێج", en: "packages", ar: "طرود", zh: "件包裹" })}</span>
                        <span className="font-mono font-semibold">{money(c.revenueUsd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">{pickLang(language, { ku: "هیچ داتایەک نییە", en: "No data", ar: "لا توجد بيانات", zh: "暂无数据" })}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent self orders table */}
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <h3 className="text-sm font-semibold">{pickLang(language, { ku: "دوایین سێلف ئۆردەرەکان", en: "Recent Self Orders", ar: "أحدث الطلبات الذاتية", zh: "最近的自助订单" })}</h3>
              <ShippingRouteFilter
                className="ms-auto"
                value={routeFilter}
                onChange={setRouteFilter}
                counts={routeCounts}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{pickLang(language, { ku: "کۆد", en: "Code", ar: "الرمز", zh: "编号" })}</TableHead>
                  <TableHead>{pickLang(language, { ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "追踪号" })}</TableHead>
                  <TableHead>{pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                  <TableHead>{pickLang(language, { ku: "گواستنەوە", en: "Shipping", ar: "الشحن", zh: "运输" })}</TableHead>
                  <TableHead className="text-end">{pickLang(language, { ku: "کێش", en: "Weight", ar: "الوزن", zh: "重量" })}</TableHead>
                  <TableHead className="text-end">{pickLang(language, { ku: "داهات", en: "Revenue", ar: "الإيراد", zh: "收入" })}</TableHead>
                  <TableHead className="text-end">{pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })}</TableHead>
                  <TableHead>{pickLang(language, { ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{pickLang(language, { ku: "بارکردن…", en: "Loading…", ar: "جارٍ التحميل…", zh: "加载中…" })}</TableCell></TableRow>
                ) : recent.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{pickLang(language, { ku: "هیچ سێلف ئۆردەرێک نییە", en: "No self orders", ar: "لا توجد طلبات ذاتية", zh: "暂无自助订单" })}</TableCell></TableRow>
                ) : (
                  recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.packageCode}</TableCell>
                      <TableCell className="font-mono text-xs" dir="ltr">{r.trackingNumber || "—"}</TableCell>
                      <TableCell className="text-sm">{r.customerName || r.customerCode || "—"}</TableCell>
                      <TableCell className="text-sm">{SHIP_LABEL[r.shippingType] ? pickLang(language, SHIP_LABEL[r.shippingType]) : r.shippingType}</TableCell>
                      <TableCell className="text-end font-mono text-xs">{r.weightKg.toFixed(2)} kg</TableCell>
                      <TableCell className="text-end font-mono text-sm">{money(r.revenueUsd)}</TableCell>
                      <TableCell className="text-end font-mono text-sm font-semibold text-teal-700 dark:text-teal-400">{money(r.profitUsd)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{STATUS_LABEL[r.status] ? pickLang(language, STATUS_LABEL[r.status]) : r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
