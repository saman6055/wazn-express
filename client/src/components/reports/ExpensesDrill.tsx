import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtDate } from "@/lib/numericDate";
import { ReportDrillSheet, type DrillColumn } from "./ReportDrillSheet";

/*
 * The expenses behind a figure the server added up: the same table over the
 * same window, read when the sheet opens. A second query, so the card's figure
 * comes in too and any difference is said rather than hidden.
 */

export interface ExpenseDrill {
  title: string;
  startDate: Date;
  endDate: Date;
  categoryId?: number;
  /** What the card says, to check the rows against. */
  expected: number;
}

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ExpensesDrill({ drill, onClose }: { drill: ExpenseDrill | null; onClose: () => void }) {
  const { language } = useTranslation();
  const { data, isLoading } = trpc.expenses.list.useQuery(
    { startDate: drill?.startDate, endDate: drill?.endDate, categoryId: drill?.categoryId },
    { enabled: !!drill },
  );
  const rows: any[] = data ?? [];

  const columns: DrillColumn<any>[] = [
    { header: pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" }), cell: (e) => fmtDate(e.expenseDate), ltr: true },
    { header: pickLang(language, { ku: "وردەکاری", en: "Detail", ar: "التفاصيل", zh: "详情" }), cell: (e) => e.description || e.vendor || "—", className: "max-w-[18rem] whitespace-normal text-xs" },
    {
      header: pickLang(language, { ku: "بڕ", en: "Amount", ar: "المبلغ", zh: "金额" }),
      ltr: true,
      cell: (e) => money(Number(e.amountUsd || 0)),
      total: (list) => money(list.reduce((n, e) => n + Number(e.amountUsd || 0), 0)),
    },
  ];

  const sum = rows.reduce((n, e) => n + Number(e.amountUsd || 0), 0);
  const differs = !!drill && !isLoading && Math.abs(sum - drill.expected) >= 0.01;

  return (
    <ReportDrillSheet
      open={!!drill}
      title={drill?.title ?? ""}
      rows={rows}
      columns={columns}
      rowKey={(e) => e.id}
      testId="expenses-drill"
      onClose={onClose}
      loading={isLoading}
      manage={{ href: "/company/expenses", label: pickLang(language, { ku: "لاپەڕەی خەرجییەکان", en: "Expenses page", ar: "صفحة المصروفات", zh: "支出页面" }) }}
      before={differs ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300" data-testid="expenses-drill-differs">
          {pickLang(language, {
            ku: `ئەم لیستە لەگەڵ کارتەکە یەک ناگرێتەوە: کارتەکە ${money(drill!.expected)} دەڵێت.`,
            en: `This list does not match the card: the card says ${money(drill!.expected)}.`,
            ar: `هذه القائمة لا تطابق البطاقة: البطاقة تقول ${money(drill!.expected)}.`,
            zh: `此列表与卡片不符：卡片显示 ${money(drill!.expected)}。`,
          })}
        </p>
      ) : undefined}
    />
  );
}
