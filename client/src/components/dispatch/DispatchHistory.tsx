import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, FileText, Loader2, PackageOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtTime } from "@/lib/numericDate";

/**
 * What the dispatch check has kept (owner, 2026-10-26): batches still being
 * packed, and every finished check with its report. Shown when no batch is
 * chosen - before, the page was a bare batch picker, and a batch that had
 * already left China was not even in it.
 */
export function DispatchHistory({ onOpen }: { onOpen: (batchId: number) => void }) {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const { data, isLoading } = trpc.dispatch.history.useQuery();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const rows = data ?? [];
  const working = rows.filter((r) => !r.finishedAt);
  const done = rows.filter((r) => r.finishedAt);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground" data-testid="dispatch-history-empty">
        {L({ ku: "هێشتا هیچ باچێک نەخراوەتە ناو کارتۆن. لە سەرەوە باچێک هەڵبژێرە بۆ دەستپێکردن.", en: "No batch has been packed into cartons yet. Choose a batch above to start.", ar: "لم تُعبأ أي دفعة في كراتين بعد. اختر دفعة أعلاه للبدء.", zh: "尚无批次装箱。请在上方选择批次开始。" })}
      </p>
    );
  }

  const card = (r: (typeof rows)[number]) => (
    <div key={r.batchId} className="rounded-xl border bg-card p-4" data-testid="dispatch-history-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-lg font-bold" dir="ltr">{r.batchCode}</p>
          <p className="text-xs text-muted-foreground">
            {r.finishedAt
              ? <>{fmtDate(new Date(r.finishedAt))} {fmtTime(new Date(r.finishedAt))}{r.finishedBy ? ` · ${r.finishedBy}` : ""}</>
              : L({ ku: "هێشتا تەواو نەکراوە", en: "Not finished yet", ar: "لم يكتمل بعد", zh: "尚未完成" })}
          </p>
        </div>
        {r.finishedAt
          ? (r.leftOut > 0
            ? <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            : <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />)
          : <PackageOpen className="h-5 w-5 text-sky-600 dark:text-sky-400" />}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center tabular-nums">
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-lg font-semibold">{r.cartons}</p>
          <p className="text-[11px] text-muted-foreground">{L({ ku: "کارتۆن", en: "cartons", ar: "كرتون", zh: "箱" })}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-lg font-semibold">{r.parcels}<span className="text-xs text-muted-foreground">/{r.totalParcels}</span></p>
          <p className="text-[11px] text-muted-foreground">{L({ ku: "پاکێج", en: "parcels", ar: "طرد", zh: "件" })}</p>
        </div>
        <div className={`rounded-md p-2 ${r.leftOut > 0 ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "bg-muted/50"}`}>
          <p className="text-lg font-semibold">{r.leftOut}</p>
          <p className="text-[11px]">{L({ ku: "بەجێماو", en: "left out", ar: "متبقٍ", zh: "未装" })}</p>
        </div>
      </div>
      {r.weightKg > 0 && <p className="mt-2 text-xs text-muted-foreground" dir="ltr">{r.weightKg.toFixed(2)} kg</p>}
      {r.note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{r.note}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant={r.finishedAt ? "outline" : "default"} onClick={() => onOpen(r.batchId)} data-testid="dispatch-history-open">
          {r.finishedAt
            ? L({ ku: "کردنەوە", en: "Open", ar: "فتح", zh: "打开" })
            : L({ ku: "بەردەوامبوون", en: "Continue", ar: "متابعة", zh: "继续" })}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/dispatch-check/${r.batchId}/report`} data-testid="dispatch-history-report">
            <FileText className="me-1 h-4 w-4" />
            {L({ ku: "ڕاپۆرت", en: "Report", ar: "التقرير", zh: "报告" })}
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5" data-testid="dispatch-history">
      {working.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{L({ ku: `لە کاردایە (${working.length})`, en: `In progress (${working.length})`, ar: `قيد العمل (${working.length})`, zh: `进行中（${working.length}）` })}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{working.map(card)}</div>
        </section>
      )}
      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{L({ ku: `تەواوبوو (${done.length})`, en: `Finished (${done.length})`, ar: `مكتمل (${done.length})`, zh: `已完成（${done.length}）` })}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{done.map(card)}</div>
        </section>
      )}
    </div>
  );
}
