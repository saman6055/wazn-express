import { useMemo, useState } from "react";
import { Link } from "wouter";
import { PackageX, Search } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import { parcelListHref } from "@shared/parcelSource";
import { formatRowDate } from "@/components/ui/relative-time";

/**
 * Parcels that went out without a box - read only.
 *
 * The owner, 2026-10-20: a parcel forgotten at the scanner went home with the
 * customer and nobody billed it (Zainab, 79135534330219, more than once).
 * The box now counts what it waits for; this is the list of the ones from
 * before: marked delivered, in no box that was not cancelled, by the parcel
 * or by its tracking (server/db/boxMissing.db.ts). Each row says whether its
 * charge is on the customer's account. Nothing here changes anything.
 */
export default function DeliveredWithoutBox() {
  const { language } = useLanguage();
  const { data, isLoading } = trpc.packages.deliveredWithoutBox.useQuery();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = data ?? [];
    if (!term) return all;
    return all.filter((r) =>
      [r.trackingNumber, r.packageCode, r.customerCode, r.customerName, r.batchCode, r.orderCode]
        .some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }, [data, search]);

  const totals = useMemo(() => {
    const all = data ?? [];
    const sum = (list: typeof all) => list.reduce((s, r) => s + (Number(r.calculatedCostUsd) || 0), 0);
    const notCharged = all.filter((r) => !Number(r.isCharged));
    return {
      count: all.length,
      customers: new Set(all.map((r) => r.customerId)).size,
      totalUsd: sum(all),
      notChargedCount: notCharged.length,
      notChargedUsd: sum(notCharged),
    };
  }, [data]);

  const L = (ku: string, en: string, ar: string, zh: string) => pickLang(language, { ku, en, ar, zh });

  return (
    <DashboardLayout>
      <div className="space-y-4 p-2 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <PackageX className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{L("بێ بۆکس دەرچوون", "Out without a box", "خرجت بلا صندوق", "未装箱即出库")}</h1>
            <p className="text-sm text-muted-foreground">
              {L(
                "پاکێجانێک کە «گەیاندرا»ن بەبێ ئەوەی هەرگیز لە بۆکسێکدا بووبن. تەنها خوێندنەوەیە - هیچ ناگۆڕێت.",
                "Parcels marked delivered that were never in a box. Read only - nothing here changes anything.",
                "طرود مُعلّمة كمسلّمة لم تكن في أي صندوق. للقراءة فقط - لا يغيّر شيئاً.",
                "标记为已送达但从未装箱的包裹。只读 - 不会更改任何内容。",
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: L("پاکێج", "Parcels", "طرود", "包裹"), value: String(totals.count) },
            { label: L("کڕیار", "Customers", "عملاء", "客户"), value: String(totals.customers) },
            { label: L("کۆی تێچوو", "Total charge", "إجمالي الأجرة", "运费合计"), value: `$${totals.totalUsd.toFixed(2)}` },
            {
              label: L("لەسەر حیساب نییە", "Not on the account", "ليست على الحساب", "未记账"),
              value: `${totals.notChargedCount} · $${totals.notChargedUsd.toFixed(2)}`,
              danger: totals.notChargedCount > 0,
            },
          ].map((c) => (
            <Card key={c.label} className={c.danger ? "border-red-400/60" : undefined}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className={`text-lg font-bold tabular-nums ${c.danger ? "text-red-600 dark:text-red-400" : ""}`} dir="ltr">{c.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L("گەڕان: تراک، کڕیار، باچ...", "Search: tracking, customer, batch...", "بحث: تتبع، عميل، دفعة...", "搜索：运单、客户、批次...")}
            className="ps-9"
          />
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground" data-testid="never-boxed-empty">
                {L("هیچ پاکێجێک بێ بۆکس دەرنەچووە ✓", "No parcel went out without a box ✓", "لم يخرج أي طرد بلا صندوق ✓", "没有未装箱出库的包裹 ✓")}
              </div>
            ) : (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>{L("کڕیار", "Customer", "العميل", "客户")}</TableHead>
                    <TableHead>{L("تراکینگ", "Tracking", "التتبع", "运单")}</TableHead>
                    <TableHead>{L("ئۆردەر", "Order", "الطلب", "订单")}</TableHead>
                    <TableHead>{L("باچ", "Batch", "الدفعة", "批次")}</TableHead>
                    <TableHead>{L("تێچوو", "Charge", "الأجرة", "运费")}</TableHead>
                    <TableHead>{L("حیساب", "Account", "الحساب", "账户")}</TableHead>
                    <TableHead>{L("بەروار", "Date", "التاريخ", "日期")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const tracking = r.trackingNumber || r.packageCode;
                    const charged = Boolean(Number(r.isCharged));
                    return (
                      <TableRow key={r.id} data-testid="never-boxed-row">
                        <TableCell>
                          <Link href={`/customers/${r.customerId}`} className="font-semibold text-primary hover:underline">
                            {r.customerName ?? "—"}
                          </Link>
                          <div className="text-muted-foreground" dir="ltr">{r.customerCode}</div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">
                            <Link href={parcelListHref(tracking)} className="font-mono text-primary hover:underline" dir="ltr">{tracking}</Link>
                            <CopyButton value={tracking} />
                          </span>
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono">{r.orderCode ?? "—"}</TableCell>
                        <TableCell dir="ltr" className="font-mono">{r.batchCode ?? "—"}</TableCell>
                        <TableCell dir="ltr" className="tabular-nums">${(Number(r.calculatedCostUsd) || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {charged ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                              {L("لەسەر حیسابە", "On the account", "على الحساب", "已记账")}
                            </span>
                          ) : (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                              {L("لەسەر حیساب نییە", "Not on the account", "ليست على الحساب", "未记账")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell dir="ltr" className="tabular-nums">{r.deliveredAt ? formatRowDate(new Date(r.deliveredAt)) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
