import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle2, PackageSearch, ScanBarcode } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { pickLang } from "@/lib/lang";
import { soundManager } from "@/lib/soundManager";
import { cn } from "@/lib/utils";

/**
 * How much of the customer's batch is in a box.
 *
 * The owner, 2026-10-20: a parcel forgotten at the scanner went home with the
 * customer and nobody billed it (Zainab, 79135534330219, more than once).
 * 2026-10-21: «لێرە بگۆتبایە 10/3» - so the box shows «3/10 سکان کرا» with
 * the trackings still out, counts every scan, and after a minute without a
 * scan with parcels left says so again with a soft sound. Before a receipt
 * goes out the office is asked «ئاگاداری...؟» (MissingParcelsQuestion) -
 * nothing is stored, nothing on a parcel changes. The numbers are the
 * server's (server/db/boxMissing.db.ts): every parcel of the customer in the
 * box's batch, scanned = in any box that was not cancelled.
 */

export const MISSING_WORDS = {
  scanNow: { ku: "ئێستا سکانی دەکەم", en: "Scan it now", ar: "سأمسحه الآن", zh: "现在扫描" },
  question: {
    ku: "ئاگاداری کە ئەم تراکانەی هەمان باچ لەناو بۆکس نین؟",
    en: "Do you know these trackings of the same batch are not in a box?",
    ar: "هل تعلم أن أرقام التتبع هذه من نفس الدفعة ليست في صندوق؟",
    zh: "您知道同批次的这些运单不在箱子里吗？",
  },
  yes: { ku: "بەڵێ، ئاگادارم - بەردەوام بە", en: "Yes, I know - go on", ar: "نعم، أعلم - تابع", zh: "是的，我知道 - 继续" },
  no: { ku: "نەخێر، دەگەڕێمەوە سکانی دەکەم", en: "No, I'll go back and scan", ar: "لا، سأعود وأمسح", zh: "不，我回去扫描" },
};

export function scannedLine(language: string, scanned: number, total: number) {
  return pickLang(language, {
    ku: `${scanned}/${total} سکان کرا`,
    en: `${scanned}/${total} scanned`,
    ar: `تم مسح ${scanned}/${total}`,
    zh: `已扫描 ${scanned}/${total}`,
  });
}

function leftLine(language: string, left: number) {
  return pickLang(language, { ku: `${left} ماوە`, en: `${left} left`, ar: `${left} متبقية`, zh: `还剩 ${left}` });
}

function stillLeftLine(language: string, left: number) {
  return pickLang(language, {
    ku: `هێشتا ${left} پاکێج ماوە`,
    en: `${left} parcel(s) still left`,
    ar: `لا يزال ${left} طرد`,
    zh: `还剩 ${left} 个包裹`,
  });
}

/** The trackings still out, each with its copy. */
export function MissingList({
  missing,
  language,
  onScanNow,
}: {
  missing: Array<{ id: number; trackingNumber: string | null; packageCode: string }>;
  language: string;
  onScanNow?: () => void;
}) {
  return (
    <ul className="max-h-56 divide-y divide-border/60 overflow-y-auto rounded-md border bg-background/80">
      {missing.map((m) => {
        const name = m.trackingNumber || m.packageCode;
        return (
          <li key={m.id} className="flex items-center gap-2 px-2.5 py-1.5" data-testid="box-missing-row">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
            <span dir="ltr" className="min-w-0 truncate font-mono text-sm font-semibold">{name}</span>
            <CopyButton value={name} />
            {onScanNow && (
              <Button type="button" size="sm" variant="ghost" className="ms-auto h-7 gap-1 px-2 text-xs" onClick={onScanNow}>
                <ScanBarcode className="h-3.5 w-3.5" />
                {pickLang(language, MISSING_WORDS.scanNow)}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function BoxMissingParcels({
  boxId,
  canScan,
  language,
  scanTick,
  onScanNow,
  className,
}: {
  boxId: number;
  /** The box takes parcels now (open, not paid): the minute runs only then. */
  canScan: boolean;
  language: string;
  /** Goes up on every scan into this box: the count and the minute start again. */
  scanTick: number;
  onScanNow?: () => void;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const { data } = trpc.deliveryBox.missingParcels.useQuery({ boxId }, { refetchInterval: 15000 });

  useEffect(() => {
    if (scanTick > 0) void utils.deliveryBox.missingParcels.invalidate({ boxId });
  }, [scanTick, boxId, utils]);

  // A minute without a scan, parcels left: said again, softly, each minute.
  const left = data?.missing.length ?? 0;
  const leftRef = useRef(left);
  leftRef.current = left;
  useEffect(() => {
    if (!canScan) return;
    const id = setInterval(() => {
      if (leftRef.current > 0) {
        soundManager.playWarning();
        toast.warning(stillLeftLine(language, leftRef.current), { duration: 8000 });
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [canScan, scanTick, language]);

  if (!data || data.total === 0) return null;
  const done = left === 0;
  const pct = Math.round((data.scanned / data.total) * 100);

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        done ? "border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/20" : "border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/20",
        className,
      )}
      data-testid={done ? "box-missing-none" : "box-missing"}
    >
      <div className="flex items-center gap-3">
        {done ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <PackageSearch className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
        <span className="text-lg font-bold tabular-nums" dir="ltr" data-testid="box-scan-count">
          {data.scanned}/{data.total}
        </span>
        <span className="text-sm font-medium">{pickLang(language, { ku: "سکان کرا", en: "scanned", ar: "تم المسح", zh: "已扫描" })}</span>
        {!done && (
          <span className="ms-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {leftLine(language, left)}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn("h-full rounded-full transition-all", done ? "bg-emerald-500" : "bg-amber-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!done && (
        <div className="mt-2.5">
          <MissingList missing={data.missing} language={language} onScanNow={canScan ? onScanNow : undefined} />
        </div>
      )}
    </div>
  );
}
