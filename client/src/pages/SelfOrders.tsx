import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
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
const SHIP_LABEL: Record<string, string> = {
  air_regular: "ئاسمانی ئاسایی",
  air_irregular: "ئاسمانی نائاسایی",
  sea: "دەریایی",
};

const STATUS_LABEL: Record<string, string> = {
  registered: "تۆمارکراو",
  in_batch: "لە باچدا",
  in_transit: "لە ڕێگادا",
  customs_processing: "گومرگ",
  ready_for_delivery: "ئامادەی گەیاندن",
  out_for_delivery: "لە گەیاندندا",
  delivered: "گەیەنرا",
  returned: "گەڕێنراوە",
  cancelled: "هەڵوەشێنرا",
};

function money(n: number | undefined) {
  return `$${(n ?? 0).toFixed(2)}`;
}

export default function SelfOrders() {
  const { t } = useTranslation();
  const [days, setDays] = useState<string>("all");
  const { data, isLoading } = trpc.reports.selfOrderReport.useQuery({
    days: days === "all" ? undefined : Number(days),
  });
  const s = data?.summary;
  const recent = data?.recent ?? [];

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
              <h1 className="text-xl font-bold">{t("nav.selfOrders") || "سێلف ئۆردەر"}</h1>
              <p className="text-sm text-muted-foreground">
                پاکێجی خۆکڕاو — کڕیار خۆی کڕیویەتی، ئێمە تەنها گواستنەوەمان بۆ کردووە
              </p>
            </div>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">٧ ڕۆژی ڕابردوو</SelectItem>
              <SelectItem value="30">٣٠ ڕۆژی ڕابردوو</SelectItem>
              <SelectItem value="90">٩٠ ڕۆژی ڕابردوو</SelectItem>
              <SelectItem value="all">هەمووی</SelectItem>
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
                <p className="text-xs text-muted-foreground">کۆی سێلف ئۆردەر</p>
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
                <p className="text-xs text-muted-foreground">داهاتی گواستنەوە</p>
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
                <p className="text-xs text-muted-foreground">قازانج</p>
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
                <p className="text-xs text-muted-foreground">باشترین کڕیار</p>
                <p className="truncate text-base font-bold">
                  {s?.topCustomers?.[0]?.name || s?.topCustomers?.[0]?.code || "—"}
                </p>
                {s?.topCustomers?.[0] && (
                  <p className="text-xs text-muted-foreground">{s.topCustomers[0].count} پاکێج · {money(s.topCustomers[0].revenueUsd)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* By shipping type + top customers */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold">بەپێی شێوازی گواستنەوە</h3>
              <div className="space-y-2">
                {(["air_regular", "air_irregular", "sea"] as const).map((tp) => {
                  const row = s?.byType?.[tp];
                  const Icon = tp === "sea" ? Ship : Plane;
                  return (
                    <div key={tp} className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${tp === "sea" ? "text-cyan-500" : tp === "air_irregular" ? "text-purple-500" : "text-blue-500"}`} />
                        <span className="text-sm">{SHIP_LABEL[tp]}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{row?.count ?? 0} پاکێج</span>
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
              <h3 className="mb-3 text-sm font-semibold">باشترین کڕیارەکانی سێلف ئۆردەر</h3>
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
                        <span className="text-muted-foreground">{c.count} پاکێج</span>
                        <span className="font-mono font-semibold">{money(c.revenueUsd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">هیچ داتایەک نییە</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent self orders table */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4">
              <h3 className="text-sm font-semibold">دوایین سێلف ئۆردەرەکان</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کۆد</TableHead>
                  <TableHead>تراکینگ</TableHead>
                  <TableHead>کڕیار</TableHead>
                  <TableHead>گواستنەوە</TableHead>
                  <TableHead className="text-end">کێش</TableHead>
                  <TableHead className="text-end">داهات</TableHead>
                  <TableHead className="text-end">قازانج</TableHead>
                  <TableHead>دۆخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">بارکردن…</TableCell></TableRow>
                ) : recent.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">هیچ سێلف ئۆردەرێک نییە</TableCell></TableRow>
                ) : (
                  recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.packageCode}</TableCell>
                      <TableCell className="font-mono text-xs" dir="ltr">{r.trackingNumber || "—"}</TableCell>
                      <TableCell className="text-sm">{r.customerName || r.customerCode || "—"}</TableCell>
                      <TableCell className="text-sm">{SHIP_LABEL[r.shippingType] || r.shippingType}</TableCell>
                      <TableCell className="text-end font-mono text-xs">{r.weightKg.toFixed(2)} kg</TableCell>
                      <TableCell className="text-end font-mono text-sm">{money(r.revenueUsd)}</TableCell>
                      <TableCell className="text-end font-mono text-sm font-semibold text-teal-700 dark:text-teal-400">{money(r.profitUsd)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{STATUS_LABEL[r.status] || r.status}</Badge>
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
