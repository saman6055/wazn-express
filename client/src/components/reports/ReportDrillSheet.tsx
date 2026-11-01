import type { ReactNode } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/*
 * The side panel behind a report's figure (owner, 2026-11-02: every figure on
 * a report opens what it was added up from).
 *
 * The rows come from the page, the same array the card summed, so a total
 * here cannot disagree with the card. The totals are worked out in the page's
 * column definitions for that reason: this file only draws them.
 */

/** What makes a card read as clickable. The same on every report. */
export const DRILL_CARD = "cursor-pointer transition hover:ring-2 hover:ring-primary/40";

/** wouter's Link ignores target, and every link out of a report opens a new tab. */
export function RecordLink({ href, children, testId }: { href: string; children: ReactNode; testId?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sky-700 underline dark:text-sky-300"
      data-testid={testId}
    >
      {children}
    </a>
  );
}

export interface DrillColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** The foot of this column, from the rows the sheet is showing. */
  total?: (rows: T[]) => ReactNode;
  ltr?: boolean;
  className?: string;
}

export function ReportDrillSheet<T>({
  open,
  title,
  rows,
  columns,
  rowKey,
  testId,
  onClose,
  loading,
  before,
  manage,
}: {
  open: boolean;
  title: string;
  rows: T[];
  columns: DrillColumn<T>[];
  rowKey: (row: T, index: number) => string | number;
  /** `<testId>` on the sheet, `<testId>-row` on each row. */
  testId: string;
  onClose: () => void;
  loading?: boolean;
  /** Anything the reader must see above the table. */
  before?: ReactNode;
  /** The list these rows live in, when there is one worth opening. */
  manage?: { href: string; label: string };
}) {
  const { language } = useTranslation();
  const hasTotal = columns.some((c) => c.total);
  // The first columns are labels, so the word "total" spans them.
  const firstTotal = columns.findIndex((c) => c.total);
  const labelSpan = Math.max(firstTotal, 1);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl" data-testid={testId}>
        <SheetHeader>
          <SheetTitle>{title} ({rows.length})</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          {manage && (
            <a href={manage.href} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-700 underline dark:text-sky-300">
              {manage.label}
            </a>
          )}
          {before}
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">
              {pickLang(language, { ku: "چاوەڕوان بە...", en: "Loading...", ar: "جارٍ التحميل...", zh: "加载中..." })}
            </p>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  {columns.map((c) => <TableHead key={c.header}>{c.header}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={rowKey(row, i)} data-testid={`${testId}-row`}>
                    {columns.map((c) => (
                      <TableCell key={c.header} dir={c.ltr ? "ltr" : undefined} className={c.className}>{c.cell(row)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                      {pickLang(language, { ku: "هیچ تۆمارێک نییە", en: "No records", ar: "لا توجد سجلات", zh: "暂无记录" })}
                    </TableCell>
                  </TableRow>
                )}
                {hasTotal && (
                  <TableRow className="font-semibold">
                    <TableCell colSpan={labelSpan}>{pickLang(language, { ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })}</TableCell>
                    {columns.slice(labelSpan).map((c) => (
                      <TableCell key={c.header} dir={c.ltr ? "ltr" : undefined}>{c.total?.(rows)}</TableCell>
                    ))}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
