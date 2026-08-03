/**
 * CustomerPendingOrdersSection
 *
 * Sits at the top of the customer Finance tab. Shows every order for this
 * customer that hasn't been delivered yet and therefore hasn't produced an
 * invoice — so staff can see at a glance what's still "in flight" and what
 * the estimated incoming revenue looks like.
 *
 * Data source: trpc.fullPackage.getCustomerPendingOrders
 * Invalidation: FullPackageDetail / CommissionDetail update+delete mutations
 *               call utils.fullPackage.getCustomerPendingOrders.invalidate()
 *               so this section auto-refreshes the moment a pending order is
 *               edited, deleted, or transitions into a delivered state.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Clock, Package, ShoppingBag, FileText, DollarSign, TrendingUp,
  Eye, Pencil, AlertCircle, Inbox,
} from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

interface Props {
  customerId: number;
}

type OrderType = "all" | "full_package" | "commission" | "purchase_request";
type SortKey = "newest" | "oldest" | "highest";

function formatRelative(iso: string | Date | null | undefined, t: (k: string) => string): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const ms = Date.now() - date.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return t("time.justNow");
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${t("time.minutesAgo")}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t("time.hoursAgo")}`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} ${t("time.daysAgo")}`;
  const mo = Math.floor(day / 30);
  return `${mo} ${t("time.monthsAgo")}`;
}

function orderTypeIcon(type: string) {
  if (type === "commission") return <ShoppingBag className="h-4 w-4" />;
  if (type === "purchase_request") return <FileText className="h-4 w-4" />;
  return <Package className="h-4 w-4" />;
}

function orderTypeLabel(type: string, t: (k: string) => string): string {
  if (type === "commission") return t("fullPackage.commission");
  if (type === "purchase_request") return t("fullPackage.purchaseRequest");
  return t("fullPackage.fullPackage");
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/60",
    approved: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800/60",
    ordered: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800/60",
    tracking_added: "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800/60",
    in_china_warehouse: "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800/60",
    in_batch: "bg-violet-100 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-800/60",
    in_transit: "bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800/60",
    arrived: "bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800/60",
    ready_for_delivery: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60",
  };
  return map[status] ?? "bg-slate-100 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800/60";
}

export function CustomerPendingOrdersSection({ customerId }: Props) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [typeFilter, setTypeFilter] = useState<OrderType>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const { data, isLoading } = trpc.fullPackage.getCustomerPendingOrders.useQuery(
    { customerId },
    {
      enabled: !!customerId,
      refetchOnWindowFocus: true,
      staleTime: 10_000,
    }
  );

  const orders = data?.orders ?? [];
  const summary = data?.summary;

  const filteredSorted = useMemo(() => {
    let list = orders as any[];
    if (typeFilter !== "all") {
      list = list.filter((o) => (o.orderType || "full_package") === typeFilter);
    }
    const sorted = [...list];
    if (sortBy === "newest") sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortBy === "oldest") sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (sortBy === "highest") {
      sorted.sort((a, b) => {
        const aVal = parseFloat(a.sellingPriceUsd || a.itemPriceUsd || "0") * (a.quantity || 1)
          + parseFloat(a.commissionFeeUsd || "0");
        const bVal = parseFloat(b.sellingPriceUsd || b.itemPriceUsd || "0") * (b.quantity || 1)
          + parseFloat(b.commissionFeeUsd || "0");
        return bVal - aVal;
      });
    }
    return sorted;
  }, [orders, typeFilter, sortBy]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg mb-4">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full mt-4" />
        </CardContent>
      </Card>
    );
  }

  const count = summary?.count ?? 0;
  const totalPrice = summary?.totalPriceUsd ?? 0;

  return (
    <Card className="border-0 shadow-lg mb-4 overflow-hidden">
      <CardHeader className="bg-gradient-to-l from-amber-500 to-orange-500 text-white pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">{t("customers.pendingOrders")}</CardTitle>
              <CardDescription className="text-amber-50">{t("customers.pendingOrdersDesc")}</CardDescription>
            </div>
          </div>
          <Badge className="bg-white text-amber-700 dark:text-amber-300 border-0 text-base px-3 py-1">
            {count} {t("common.total")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-full mb-3">
              <Inbox className="h-12 w-12 text-emerald-500" />
            </div>
            <p className="font-medium text-slate-700 dark:text-slate-300">{t("customers.noPendingOrders")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("customers.noPendingOrdersDesc")}</p>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 dark:border-blue-800/60">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-1">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-medium">{t("customers.ordersCount")}</span>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{count}</p>
                {summary && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {summary.byType.full_package} FP · {summary.byType.commission} CM · {summary.byType.purchase_request} PR
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 dark:border-emerald-800/60">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-medium">{t("customers.estimatedTotal")}</span>
                </div>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 font-mono">${totalPrice.toFixed(2)}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">{t("customers.estimatedInvoiceValue")}</p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 dark:border-purple-800/60">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">{t("customers.oldestOrder")}</span>
                </div>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                  {summary?.oldestAt ? formatRelative(summary.oldestAt, t) : "—"}
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">{t("customers.sinceCreation")}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
              <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as OrderType)}>
                <TabsList>
                  <TabsTrigger value="all">{t("common.all")} ({count})</TabsTrigger>
                  <TabsTrigger value="full_package">
                    📦 FP ({summary?.byType.full_package ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="commission">
                    🛍️ CM ({summary?.byType.commission ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="purchase_request">
                    📝 PR ({summary?.byType.purchase_request ?? 0})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex gap-1 border rounded-lg p-1 bg-muted/40">
                <Button
                  variant={sortBy === "newest" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSortBy("newest")}
                >
                  {t("customers.sortNewest")}
                </Button>
                <Button
                  variant={sortBy === "oldest" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSortBy("oldest")}
                >
                  {t("customers.sortOldest")}
                </Button>
                <Button
                  variant={sortBy === "highest" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSortBy("highest")}
                >
                  {t("customers.sortHighest")}
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-32">{t("fullPackage.orderCode")}</TableHead>
                    <TableHead>{t("fullPackage.productName")}</TableHead>
                    <TableHead className="text-center w-20">{t("fullPackage.quantity")}</TableHead>
                    <TableHead className="text-end w-24">{t("fullPackage.price")}</TableHead>
                    <TableHead className="w-40">{t("fullPackage.statusColumn")}</TableHead>
                    <TableHead className="w-36">{t("customers.lastUpdated")}</TableHead>
                    <TableHead className="w-20 text-center">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                        {t("customers.noOrdersInFilter")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSorted.map((order: any) => {
                      const isCommission = order.orderType === "commission";
                      const qty = order.quantity || 1;
                      const unit = parseFloat(order.sellingPriceUsd || order.itemPriceUsd || "0");
                      const commission = parseFloat(order.commissionFeeUsd || "0");
                      const estimated = (unit * qty) + (isCommission ? commission : 0);
                      const isFP = !isCommission && order.orderType !== "purchase_request";
                      const route = isFP
                        ? `/full-package/${order.id}`
                        : isCommission ? `/commission/${order.id}` : `/purchase-request/${order.id}`;

                      return (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => navigate(route)}
                        >
                          <TableCell className="font-mono font-semibold text-xs">{order.orderCode}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-primary/10 text-primary flex-shrink-0">
                                {orderTypeIcon(order.orderType)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate max-w-xs">{order.productName}</p>
                                <p className="text-xs text-muted-foreground">{orderTypeLabel(order.orderType, t)}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm">{qty}</TableCell>
                          <TableCell className="text-end font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                            ${estimated.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${statusColor(order.status)} text-xs`}>
                              {t(`fullPackage.status.${order.status}`) || order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatRelative(order.updatedAt, t)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => navigate(route)}
                                title={t("common.view")}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => navigate(`${route}/edit`)}
                                title={t("common.edit")}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer note */}
            <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/60 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{t("customers.pendingOrdersFooterNote")}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
