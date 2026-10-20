import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle2, PackageX, ScanBarcode, Truck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { pickLang } from "@/lib/lang";
import { soundManager } from "@/lib/soundManager";
import { cn } from "@/lib/utils";

/**
 * What this box is still waiting for.
 *
 * The owner, 2026-10-20: a parcel forgotten at the scanner went home with the
 * customer and nobody billed it (Zainab, 79135534330219, more than once).
 * So while a box is filled it counts down - «3 لە بۆکسدان · 2 ماوە» - and
 * names the trackings still out; a minute without a scan, with parcels left,
 * it says so again with a soft sound; and the receipt is not printed or sent
 * until each one is scanned or said not to have arrived (BoxDetailPanel,
 * BoxTable). The list is the server's (server/db/boxMissing.db.ts): every
 * parcel of the customer that reached the office in the box's batch and is
 * in no box at all, by parcel or by tracking.
 */

export const MISSING_WORDS = {
  allIn: { ku: "هەموو پاکێجەکان لە بۆکسدان", en: "Every parcel is in the box", ar: "كل الطرود في الصندوق", zh: "所有包裹都已装箱" },
  scanNow: { ku: "ئێستا سکانی دەکەم", en: "Scan it now", ar: "سأمسحه الآن", zh: "现在扫描" },
  notArrived: { ku: "نەگەیشتووە", en: "Not arrived", ar: "لم يصل", zh: "未到达" },
  gateTitle: { ku: "پاکێج ماوە - چاپ ڕاگیراوە", en: "Parcels left - printing waits", ar: "طرود متبقية - الطباعة متوقفة", zh: "还有包裹 - 暂停打印" },
};

export function missingCountLine(language: string, inBox: number, left: number) {
  return pickLang(language, {
    ku: `${inBox} لە بۆکسدان ✓ · ${left} ماوە ✗`,
    en: `${inBox} in the box ✓ · ${left} left ✗`,
    ar: `${inBox} في الصندوق ✓ · ${left} متبقية ✗`,
    zh: `已装 ${inBox} ✓ · 还剩 ${left} ✗`,
  });
}

function stillLeftLine(language: string, left: number) {
  return pickLang(language, {
    ku: `هێشتا ${left} پاکێج ماوە`,
    en: `${left} parcel(s) still left`,
    ar: `لا يزال ${left} طرد`,
    zh: `还剩 ${left} 个包裹`,
  });
}

export function BoxMissingParcels({
  boxId,
  inBoxCount,
  canScan,
  language,
  scanTick,
  remind,
  onScanNow,
  className,
}: {
  boxId: number;
  /** Parcels already in the box, for the count. */
  inBoxCount: number;
  /** The box takes parcels now (open, not paid). */
  canScan: boolean;
  language: string;
  /** Goes up on every scan into this box: the minute starts again. */
  scanTick: number;
  /** Speak up after a minute without a scan (the box screen, not the dialog). */
  remind?: boolean;
  onScanNow?: () => void;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const { data: missing } = trpc.deliveryBox.missingParcels.useQuery({ boxId }, { refetchInterval: 15000 });
  const notArrived = trpc.deliveryBox.markMissingNotArrived.useMutation({
    onSuccess: () => void utils.deliveryBox.missingParcels.invalidate({ boxId }),
  });

  // A scan into the box changes what is missing.
  useEffect(() => {
    if (scanTick > 0) void utils.deliveryBox.missingParcels.invalidate({ boxId });
  }, [scanTick, boxId, utils]);

  // A minute without a scan, parcels left: say it again, softly, each minute.
  const left = missing?.length ?? 0;
  const leftRef = useRef(left);
  leftRef.current = left;
  useEffect(() => {
    if (!remind || !canScan) return;
    const id = setInterval(() => {
      if (leftRef.current > 0) {
        soundManager.playWarning();
        toast.warning(stillLeftLine(language, leftRef.current), { duration: 8000 });
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [remind, canScan, scanTick, language]);

  if (!missing) return null;
  if (left === 0) {
    return inBoxCount > 0 ? (
      <div className={cn("flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200", className)} data-testid="box-missing-none">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {pickLang(language, MISSING_WORDS.allIn)} ({inBoxCount})
      </div>
    ) : null;
  }

  return (
    <div className={cn("rounded-lg border-2 border-red-400/60 bg-red-50 p-3 dark:bg-red-950/30", className)} data-testid="box-missing">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-300">
        <PackageX className="h-4 w-4 shrink-0" />
        <span>{missingCountLine(language, inBoxCount, left)}</span>
      </div>
      <ul className="space-y-1.5">
        {missing.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-md bg-background/70 px-2 py-1.5" data-testid="box-missing-row">
            <span dir="ltr" className="font-mono text-sm font-semibold">✗ {m.trackingNumber || m.packageCode}</span>
            <CopyButton value={m.trackingNumber || m.packageCode} />
            <span className="ms-auto flex flex-wrap gap-1.5">
              {canScan && onScanNow && (
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={onScanNow}>
                  <ScanBarcode className="h-3.5 w-3.5" />
                  {pickLang(language, MISSING_WORDS.scanNow)}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                disabled={notArrived.isPending}
                onClick={() => notArrived.mutate({ boxId, packageId: m.id })}
                data-testid="box-missing-not-arrived"
              >
                <Truck className="h-3.5 w-3.5" />
                {pickLang(language, MISSING_WORDS.notArrived)}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
