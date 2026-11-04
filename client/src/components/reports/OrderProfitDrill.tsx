import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtDate } from "@/lib/numericDate";
import { isLiveSale } from "@shared/orderProfit";
import { RecordLink, ReportDrillSheet, type DrillColumn } from "./ReportDrillSheet";

/*
 * The orders behind a figure the server added up.
 *
 * The profit reports get totals, not rows, so this asks for the rows when the
 * sheet opens: the detailed profit report over the same window, which prices
 * each order by the same rule (shared/orderProfit), then keeps the live sales
 * the totals counted. It is a second query, so the card's figure comes in too
 * and any difference is said out loud rather than left for the reader to find.
 */

export interface OrderDrill {
  title: string;
  /** Left out, both of the types the reports show. */
  orderType?: "full_package" | "commission";
  startDate?: Date;
  endDate?: Date;
  /** What the card says, to check the rows against. */
  expected: { count: number; profit: number };
}

/**
 * The server builds a month as `new Date(year, month - 1, 1)` in its own zone,
 * which runs in UTC. A window built in the browser's zone would start three
 * hours away from it in Erbil.
 */
export function monthWindow(year: number, month: number) {
  return {
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59)),
  };
}

export function yearWindow(year: number) {
  return {
    startDate: new Date(Date.UTC(year, 0, 1)),
    endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
  };
}

export function orderHref(order: { id: number; orderType?: string | null }) {
  return order.orderType === "commission" ? `/commission/${order.id}` : `/full-package/${order.id}`;
}

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function OrderProfitDrill({ drill, onClose }: { drill: OrderDrill | null; onClose: () => void }) {
  const { language } = useTranslation();
  const { data, isLoading, isError } = trpc.fullPackage.getProfitReport.useQuery(
    { startDate: drill?.startDate, endDate: drill?.endDate, orderType: drill?.orderType },
    { enabled: !!drill },
  );

  const rows = useMemo(
    () => (data?.orders ?? []).filter((o) => isLiveSale(o) && (o.orderType === "full_package" || o.orderType === "commission")),
    [data],
  );

  const columns: DrillColumn<(typeof rows)[number]>[] = [
    {
      header: pickLang(language, { ku: "ئۆردەر", en: "Order", ar: "الطلب", zh: "订单" }),
      cell: (o) => <RecordLink href={orderHref(o)}><span dir="ltr">{o.orderCode}</span></RecordLink>,
    },
    {
      header: pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" }),
      cell: (o) => (o.customerId ? <RecordLink href={`/customers/${o.customerId}`}>{o.customerName || `#${o.customerId}`}</RecordLink> : "—"),
    },
    {
      header: pickLang(language, { ku: "کاڵا", en: "Product", ar: "المنتج", zh: "商品" }),
      cell: (o) => o.productName,
      className: "max-w-[14rem] whitespace-normal text-xs",
    },
    {
      header: pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" }),
      cell: (o) => fmtDate(o.createdAt),
      ltr: true,
    },
    {
      header: pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" }),
      ltr: true,
      cell: (o) => money(o.profitUsd),
      total: (list) => money(list.reduce((n, o) => n + o.profitUsd, 0)),
    },
  ];

  const profit = rows.reduce((n, o) => n + o.profitUsd, 0);
  const differs = !!drill && !isLoading && !isError
    && (rows.length !== drill.expected.count || Math.abs(profit - drill.expected.profit) >= 0.01);

  return (
    <ReportDrillSheet
      open={!!drill}
      title={drill?.title ?? ""}
      rows={rows}
      columns={columns}
      rowKey={(o) => o.id}
      testId="order-profit-drill"
      onClose={onClose}
      loading={isLoading}
      before={
        <>
          {isError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">
              {pickLang(language, { ku: "ئەم لیستە تەنها بۆ بەڕێوەبەرە", en: "This list is for admins only", ar: "هذه القائمة للمديرين فقط", zh: "此列表仅限管理员" })}
            </p>
          )}
          {differs && (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300" data-testid="order-profit-drill-differs">
              {pickLang(language, {
                ku: `ئەم لیستە لەگەڵ کارتەکە یەک ناگرێتەوە: کارتەکە ${drill.expected.count} ئۆردەر و ${money(drill.expected.profit)} دەڵێت.`,
                en: `This list does not match the card: the card says ${drill.expected.count} orders and ${money(drill.expected.profit)}.`,
                ar: `هذه القائمة لا تطابق البطاقة: البطاقة تقول ${drill.expected.count} طلبات و${money(drill.expected.profit)}.`,
                zh: `此列表与卡片不符：卡片显示 ${drill.expected.count} 个订单、${money(drill.expected.profit)}。`,
              })}
            </p>
          )}
        </>
      }
    />
  );
}
