import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtDate } from "@/lib/numericDate";
import { RecordLink, ReportDrillSheet, type DrillColumn } from "./ReportDrillSheet";

/*
 * The invoices behind a figure the server added up. The invoice list has no
 * date filter, so the rows are read when the sheet opens and matched here by
 * the same conditions as the figure. A second query, so the card's figure
 * comes in too and any difference is said rather than hidden.
 */

export interface InvoiceDrillState {
  title: string;
  match: (invoice: any) => boolean;
  /** What the card says, to check the rows against. */
  expected: { count: number; amount: number };
}

/** Every invoice. A report's window is checked here, not asked of the server. */
const ALL_INVOICES = { page: 1, pageSize: 1_000_000 };

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const amountOf = (invoice: any) => Number(invoice.totalUsd || 0);

export function InvoiceDrill({ drill, onClose }: { drill: InvoiceDrillState | null; onClose: () => void }) {
  const { language } = useTranslation();
  const { data, isLoading } = trpc.invoices.getRecent.useQuery(ALL_INVOICES, { enabled: !!drill });
  const rows = useMemo(() => (drill ? ((data?.invoices ?? []) as any[]).filter(drill.match) : []), [data, drill]);

  const columns: DrillColumn<any>[] = [
    {
      header: pickLang(language, { ku: "پسوڵە", en: "Invoice", ar: "الفاتورة", zh: "发票" }),
      cell: (i) => <RecordLink href={`/invoices/${i.id}`}><span className="font-mono text-xs" dir="ltr">{i.invoiceNumber}</span></RecordLink>,
    },
    {
      header: pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" }),
      cell: (i) => (i.customerId ? <RecordLink href={`/customers/${i.customerId}`}>#{i.customerId}</RecordLink> : "—"),
    },
    { header: pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" }), cell: (i) => fmtDate(new Date(i.createdAt)), ltr: true },
    {
      header: pickLang(language, { ku: "بڕ", en: "Amount", ar: "المبلغ", zh: "金额" }),
      ltr: true,
      cell: (i) => money(amountOf(i)),
      total: (list) => money(list.reduce((n, i) => n + amountOf(i), 0)),
    },
  ];

  const sum = rows.reduce((n, i) => n + amountOf(i), 0);
  const differs = !!drill && !isLoading
    && (rows.length !== drill.expected.count || Math.abs(sum - drill.expected.amount) >= 0.01);

  return (
    <ReportDrillSheet
      open={!!drill}
      title={drill?.title ?? ""}
      rows={rows}
      columns={columns}
      rowKey={(i) => i.id}
      testId="invoice-drill"
      onClose={onClose}
      loading={isLoading}
      manage={{ href: "/invoices", label: pickLang(language, { ku: "لاپەڕەی پسوڵەکان", en: "Invoices page", ar: "صفحة الفواتير", zh: "发票页面" }) }}
      before={differs ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300" data-testid="invoice-drill-differs">
          {pickLang(language, {
            ku: `ئەم لیستە لەگەڵ کارتەکە یەک ناگرێتەوە: کارتەکە ${drill!.expected.count} پسوڵە و ${money(drill!.expected.amount)} دەڵێت.`,
            en: `This list does not match the card: the card says ${drill!.expected.count} invoices and ${money(drill!.expected.amount)}.`,
            ar: `هذه القائمة لا تطابق البطاقة: البطاقة تقول ${drill!.expected.count} فواتير و${money(drill!.expected.amount)}.`,
            zh: `此列表与卡片不符：卡片显示 ${drill!.expected.count} 张发票、${money(drill!.expected.amount)}。`,
          })}
        </p>
      ) : undefined}
    />
  );
}
