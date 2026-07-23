import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pickLang } from "@/lib/lang";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CalendarRange, FileDown, Loader2, Share2, SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// StatementPdfButton — downloads or shares the customer's account statement.
// Filter dialog: period presets (today / 7 / 14 / 21 days / this month / last
// month / this year / custom from–to dates) and type (all / charges only /
// payments only). On mobile a Share button hands the PDF straight to the
// share sheet (WhatsApp etc.); labels inside the PDF follow the customer's
// language, numbers stay Latin.
// ---------------------------------------------------------------------------

type Period =
  | "all"
  | "today"
  | "last_7"
  | "last_14"
  | "last_21"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";
type TxType = "all" | "charges" | "payments";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

/** Can this browser share files (mobile share sheet)? */
function canShareFiles(): boolean {
  try {
    const probe = new File([""], "probe.pdf", { type: "application/pdf" });
    return !!navigator.canShare && navigator.canShare({ files: [probe] });
  } catch {
    return false;
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
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Whether the in-flight request should end in the share sheet or a download.
  const shareIntent = useRef(false);

  const exportPdf = trpc.customerPortal.getMyStatementPdf.useMutation({
    onSuccess: async (data) => {
      const bytes = atob(data.pdf);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });

      if (shareIntent.current && canShareFiles()) {
        try {
          await navigator.share({ files: [new File([blob], data.filename, { type: "application/pdf" })] });
          setOpen(false);
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return; // user closed the sheet
          // fall through to a normal download on any real failure
        }
      }

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

  const resolveRange = (): { from?: Date; to?: Date } | null => {
    const now = new Date();
    switch (period) {
      case "today":
        return { from: startOfDay(now), to: now };
      case "last_7":
        return { from: daysAgo(7), to: now };
      case "last_14":
        return { from: daysAgo(14), to: now };
      case "last_21":
        return { from: daysAgo(21), to: now };
      case "this_month":
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
      case "last_month":
        return {
          from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
        };
      case "this_year":
        return { from: new Date(now.getFullYear(), 0, 1), to: now };
      case "custom": {
        if (!customFrom || !customTo) {
          toast.error(pick({ ku: "هەردوو بەروارەکە هەڵبژێرە", en: "Pick both dates", ar: "اختر التاريخين", zh: "请选择两个日期" }));
          return null;
        }
        const from = startOfDay(new Date(customFrom));
        const to = endOfDay(new Date(customTo));
        if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
          toast.error(pick({ ku: "مەودای بەروارەکە هەڵەیە", en: "Invalid date range", ar: "مدى التاريخ غير صحيح", zh: "日期范围无效" }));
          return null;
        }
        return { from, to };
      }
      default:
        return {};
    }
  };

  const run = (share: boolean) => {
    const range = resolveRange();
    if (!range) return;
    shareIntent.current = share;
    exportPdf.mutate({
      language: (["ku", "en", "ar", "zh"].includes(language) ? language : "en") as "ku" | "en" | "ar" | "zh",
      from: range.from,
      to: range.to,
      type: txType,
    });
  };

  const PERIODS: { value: Period; label: { ku: string; en: string; ar: string; zh: string } }[] = [
    { value: "all", label: { ku: "هەموو کات", en: "All time", ar: "كل الفترات", zh: "全部时间" } },
    { value: "today", label: { ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" } },
    { value: "last_7", label: { ku: "ئەم هەفتەیە (٧ ڕۆژ)", en: "Last 7 days", ar: "آخر ٧ أيام", zh: "最近7天" } },
    { value: "last_14", label: { ku: "دوو هەفتە (١٤ ڕۆژ)", en: "Last 14 days", ar: "آخر ١٤ يوماً", zh: "最近14天" } },
    { value: "last_21", label: { ku: "سێ هەفتە (٢١ ڕۆژ)", en: "Last 21 days", ar: "آخر ٢١ يوماً", zh: "最近21天" } },
    { value: "this_month", label: { ku: "ئەم مانگە", en: "This month", ar: "هذا الشهر", zh: "本月" } },
    { value: "last_month", label: { ku: "مانگی ڕابردوو", en: "Last month", ar: "الشهر الماضي", zh: "上个月" } },
    { value: "this_year", label: { ku: "ئەم ساڵە", en: "This year", ar: "هذه السنة", zh: "今年" } },
    { value: "custom", label: { ku: "مەودای دڵخواز (لە... بۆ...)", en: "Custom range (from–to)", ar: "مدى مخصص (من–إلى)", zh: "自定义范围（从–到）" } },
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

            {period === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {pick({ ku: "لە بەرواری", en: "From", ar: "من", zh: "从" })}
                  </label>
                  <Input type="date" dir="ltr" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {pick({ ku: "بۆ بەرواری", en: "To", ar: "إلى", zh: "到" })}
                  </label>
                  <Input type="date" dir="ltr" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </div>
            )}

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

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => run(false)}
                disabled={exportPdf.isPending}
                className="h-11 flex-1 rounded-xl bg-indigo-600 text-sm font-bold hover:bg-indigo-700"
              >
                {exportPdf.isPending && !shareIntent.current ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                {pick({ ku: "داگرتن", en: "Download", ar: "تنزيل", zh: "下载" })}
              </Button>
              {canShareFiles() && (
                <Button
                  onClick={() => run(true)}
                  disabled={exportPdf.isPending}
                  variant="outline"
                  className="h-11 flex-1 rounded-xl border-emerald-300 text-sm font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                >
                  {exportPdf.isPending && shareIntent.current ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  {pick({ ku: "هاوبەشکردن", en: "Share", ar: "مشاركة", zh: "分享" })}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
