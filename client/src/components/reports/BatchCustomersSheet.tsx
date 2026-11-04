import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { packagesHref } from "@shared/listLinks";
import { RecordLink, ReportDrillSheet, type DrillColumn } from "./ReportDrillSheet";

/*
 * Who a batch's figures came from: the report's own customer breakdown, the
 * rows its totals were added up from, each opening the customer and that
 * customer's parcels in this batch.
 */

interface BreakdownRow {
  customerId: number;
  packages: number;
  chargeableWeight?: number;
  cbm?: number;
  revenue: number;
}

export function BatchCustomersSheet({
  title,
  rows,
  batchId,
  sea,
  codeOf,
  nameOf,
  onClose,
}: {
  /** Null while closed. */
  title: string | null;
  rows: BreakdownRow[];
  batchId: number;
  sea: boolean;
  codeOf: (customerId: number) => string;
  nameOf: (customerId: number) => string;
  onClose: () => void;
}) {
  const { language } = useTranslation();
  const amount = (r: BreakdownRow) => (sea ? r.cbm ?? 0 : r.chargeableWeight ?? 0);
  const places = sea ? 3 : 2;
  const columns: DrillColumn<BreakdownRow>[] = [
    {
      header: pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" }),
      cell: (r) => <RecordLink href={`/customers/${r.customerId}`}>{nameOf(r.customerId)}</RecordLink>,
    },
    {
      header: pickLang(language, { ku: "پاکەت", en: "Packages", ar: "الطرود", zh: "包裹" }),
      cell: (r) => <RecordLink href={packagesHref({ batch: String(batchId), search: codeOf(r.customerId) })}>{r.packages}</RecordLink>,
      total: (list) => list.reduce((n, r) => n + r.packages, 0),
    },
    {
      header: sea ? "CBM" : pickLang(language, { ku: "کێش حسابکراو", en: "Chargeable weight", ar: "الوزن المحتسب", zh: "计费重量" }),
      ltr: true,
      cell: (r) => amount(r).toFixed(places),
      total: (list) => list.reduce((n, r) => n + amount(r), 0).toFixed(places),
    },
    {
      header: pickLang(language, { ku: "داهات", en: "Revenue", ar: "الإيرادات", zh: "收入" }),
      ltr: true,
      cell: (r) => `$${r.revenue.toFixed(2)}`,
      total: (list) => `$${list.reduce((n, r) => n + r.revenue, 0).toFixed(2)}`,
    },
  ];

  return (
    <ReportDrillSheet
      open={title !== null}
      title={title ?? ""}
      rows={rows}
      columns={columns}
      rowKey={(r) => r.customerId}
      testId="batch-customers-drill"
      onClose={onClose}
      manage={{
        href: packagesHref({ batch: String(batchId) }),
        label: pickLang(language, { ku: "هەموو پاکەتەکانی ئەم باچە", en: "All parcels in this batch", ar: "كل طرود هذه الدفعة", zh: "本批次全部包裹" }),
      }}
    />
  );
}
