import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pickLang } from "@/lib/lang";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CalendarRange, FileDown, Loader2, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// StatementPdfButton — downloads the customer's account statement as PDF.
// Opens a small filter dialog first: period (all / this month / last month /
// this year) and type (all / charges / payments). Labels inside the PDF come
// out in the customer's language; numbers stay Latin.
// ---------------------------------------------------------------------------

type Period = "all" | "this_month" | "last_month" | "this_year";
type TxType = "all" | "charges" | "payments";

function periodRange(period: Period): { from?: Date; to?: Date } {
  const now = new Date();
  switch (period) {
    case "this_month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case "last_month":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      };
    case "this_year":
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    default:
      return {};
  }
}

export function StatementPdfButton({
  language,
  className,
}: {
  language: string;
  className?: string;
}) {
  const pick = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);
  const isRTL = language === "ku" || language === "ar";

  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [txType, setTxType] = useState<TxType>("all");

  const exportPdf = trpc.customerPortal.getMyStatementPdf.useMutation({
    onSuccess: (data) => {
      // base64 → Blob → anchor download (same pattern as the staff dashboard)
      const bytes = atob(data.pdf);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
      toast.success(pick({ ku: "کەشفی حساب داگیرا", en: "Statement downloaded", ar: "تم تنزيل كشف الحساب", zh: "对账单已下载" }));
    },
    onError: (e) => toast.error(e.message),
  });

  const download = () => {
    const { from, to } = periodRange(period);
    exportPdf.mutate({
      language: (["ku", "en", "ar", "zh"].includes(language) ? language : "en") as "ku" | "en" | "ar" | "zh",
      from,
      to,
      type: txType,
    });
  };

  const PERIODS: { value: Period; label: { ku: string; en: string; ar: string; zh: string } }[] = [
    { value: "all", label: { ku: "هەموو کات", en: "All time", ar: "كل الفترات", zh: "全部时间" } },
    { value: "this_month", label: { ku: "ئەم مانگە", en: "This month", ar: "هذا الشهر", zh: "本月" } },
    { value: "last_month", label: { ku: "مانگی ڕابردوو", en: "Last month", ar: "الشهر الماضي", zh: "上个月" } },
    { value: "this_year", label: { ku: "ئەم ساڵە", en: "This year", ar: "هذه السنة", zh: "今年" } },
  ];

  const TYPES: { value: TxType; label: { ku: string; en: string; ar: string; zh: string } }[] = [
    { value: "all", label: { ku: "هەموو مامەڵەکان", en: "All transactions", ar: "كل المعاملات", zh: "全部交易" } },
    { value: "charges", label: { ku: "تەنها قەرزەکان", en: "Charges only", ar: "المصاريف فقط", zh: "仅费用" } },
    { value: "payments", label: { ku: "تەنها پارەدانەکان", en: "Payments only", ar: "المدفوعات فقط", zh: "仅付款" } },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95",
          className,
        )}
      >
        <FileDown className="h-4 w-4" />
        {pick({ ku: "داگرتنی کەشفی حساب PDF", en: "Download statement PDF", ar: "تنزيل كشف الحساب PDF", zh: "下载对账单 PDF" })}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
              {pick({ ku: "کەشفی حساب — فلتەر", en: "Statement — filters", ar: "كشف الحساب — تصفية", zh: "对账单——筛选" })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" />
                {pick({ ku: "ماوە", en: "Period", ar: "الفترة", zh: "时间段" })}
              </label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{pick(p.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {pick({ ku: "جۆر", en: "Type", ar: "النوع", zh: "类型" })}
              </label>
              <Select value={txType} onValueChange={(v) => setTxType(v as TxType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{pick(t.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={download}
              disabled={exportPdf.isPending}
              className="h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold hover:bg-indigo-700"
            >
              {exportPdf.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              {pick({ ku: "داگرتن", en: "Download", ar: "تنزيل", zh: "下载" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
