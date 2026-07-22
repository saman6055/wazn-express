import { pickLang } from "@/lib/lang";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// StatementPdfButton — downloads the customer's own account statement as PDF
// (server-rendered, same report the staff can export). Drop-in for any skin.
// ---------------------------------------------------------------------------

export function StatementPdfButton({
  language,
  className,
}: {
  language: string;
  className?: string;
}) {
  const pick = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

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
      toast.success(pick({ ku: "کەشفی حساب داگیرا", en: "Statement downloaded", ar: "تم تنزيل كشف الحساب", zh: "对账单已下载" }));
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <button
      type="button"
      onClick={() => exportPdf.mutate()}
      disabled={exportPdf.isPending}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 disabled:opacity-60",
        className,
      )}
    >
      {exportPdf.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      {pick({ ku: "داگرتنی کەشفی حساب PDF", en: "Download statement PDF", ar: "تنزيل كشف الحساب PDF", zh: "下载对账单 PDF" })}
    </button>
  );
}
