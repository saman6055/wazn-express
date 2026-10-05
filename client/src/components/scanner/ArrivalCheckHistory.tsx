import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, History, Loader2, Package, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { fmtWhen } from "@/lib/numericDate";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/CopyButton";
import { OrderNumbers } from "@/components/OrderNumbers";
import { parcelListHref } from "@shared/parcelSource";
import {
  isFullyArrived, missingTrackingList, notArrivedCount, splitArrival, type ManifestParcel,
} from "@shared/arrivalCheck";

/** A checked batch, as the list names it and as "continue" hands it on. */
export interface CheckedBatch {
  batchId: number;
  batchCode: string;
  shippingType: string;
  status: string;
  totalParcels: number;
  arrived: number;
  lastCheckedAt: Date | string | null;
}

/**
 * The arrival checks already done, and the way back into each one.
 *
 * The owner, 2026-10-05: «ئەو باچانەی پشکنینیان بۆ کراوە، وردەکاریی هاتوو و
 * نەهاتووەکانی لە شوێنێ بمێنێ، بتوانی دووبارە بچیتەوە سەری». The scanner above
 * offers only batches still on the road, so a check stopped being reachable
 * on the day its batch was marked as arrived — the day somebody starts asking
 * where a parcel is.
 *
 * So: a list of every batch that was checked, whatever became of it, with how
 * many turned up and how many did not; and one press opens the two lists
 * themselves — who is missing, who arrived, when it was checked in and by
 * whom. Read-only. Scanning more of a batch is done where scanning is done:
 * "continue" hands the batch back to the scanner.
 *
 * Nothing is stored for this. It is the batch's manifest set against its
 * arrival scans (shared/arrivalCheck), the same two reads the scanner uses.
 */
export function ArrivalCheckHistory({ onContinue }: { onContinue: (batch: CheckedBatch) => void }) {
  const { language } = useTranslation();
  const L = (words: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, words);
  const [open, setOpen] = useState<CheckedBatch | null>(null);

  const { data: checked, isLoading } = trpc.scanning.arrivalCheckedBatches.useQuery(undefined, {
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {L({ ku: "پشکنینە پێشووەکان دەهێنرێن…", en: "Loading earlier checks…", ar: "جارٍ تحميل الفحوصات السابقة…", zh: "正在加载以往核对…" })}
        </CardContent>
      </Card>
    );
  }
  // No check has ever been done: nothing to go back to, so no empty frame.
  if (!checked || checked.length === 0) return null;

  return (
    <>
      <Card className="border-0 shadow-lg" data-testid="arrival-history">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <History className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            {L({ ku: "باچە پشکنراوەکان", en: "Checked batches", ar: "الدفعات المفحوصة", zh: "已核对的批次" })}
            <span className="text-xs font-normal text-muted-foreground">
              {L({
                ku: "کلیک لە هەر باچێک بکە بۆ بینینی هاتوو و نەهاتووەکانی",
                en: "Open any batch to see what arrived and what did not",
                ar: "افتح أي دفعة لرؤية ما وصل وما لم يصل",
                zh: "点开任一批次查看已到与未到",
              })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {checked.map((batch) => {
              const missing = notArrivedCount(batch);
              const complete = isFullyArrived(batch);
              return (
                <button
                  key={batch.batchId}
                  type="button"
                  onClick={() => setOpen(batch as CheckedBatch)}
                  className={cn(
                    "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-2 p-3 text-start transition-colors",
                    complete
                      ? "border-emerald-200 hover:border-emerald-400 dark:border-emerald-900/60"
                      : "border-amber-200 hover:border-amber-400 dark:border-amber-900/60",
                  )}
                  data-testid="arrival-history-batch"
                >
                  <bdi dir="ltr" className="font-mono text-sm font-bold">{batch.batchCode}</bdi>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {L({
                      ku: `${batch.arrived} لە ${batch.totalParcels} گەیشت`,
                      en: `${batch.arrived} of ${batch.totalParcels} arrived`,
                      ar: `وصل ${batch.arrived} من ${batch.totalParcels}`,
                      zh: `${batch.totalParcels} 件中已到 ${batch.arrived} 件`,
                    })}
                  </span>
                  {missing > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {L({ ku: `${missing} نەهاتوو`, en: `${missing} not arrived`, ar: `${missing} لم يصل`, zh: `${missing} 件未到` })}
                    </span>
                  )}
                  {batch.lastCheckedAt && (
                    <bdi dir="ltr" className="ms-auto font-mono text-[11px] text-muted-foreground">
                      {fmtWhen(batch.lastCheckedAt, false)}
                    </bdi>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ArrivalCheckDetail
        batch={open}
        onClose={() => setOpen(null)}
        onContinue={(batch) => {
          setOpen(null);
          onContinue(batch);
        }}
      />
    </>
  );
}

function ArrivalCheckDetail({
  batch,
  onClose,
  onContinue,
}: {
  batch: CheckedBatch | null;
  onClose: () => void;
  onContinue: (batch: CheckedBatch) => void;
}) {
  const { language } = useTranslation();
  const L = (words: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, words);
  const isRTL = language !== "en" && language !== "zh";
  const batchId = batch?.batchId ?? 0;

  const manifestQ = trpc.packages.batchManifest.useQuery({ batchId }, { enabled: batchId > 0 });
  const scansQ = trpc.scanning.arrivalChecks.useQuery({ batchIds: [batchId] }, { enabled: batchId > 0, staleTime: 0 });

  const split = useMemo(
    () => splitArrival((manifestQ.data ?? []) as ManifestParcel[], scansQ.data ?? []),
    [manifestQ.data, scansQ.data],
  );
  const loading = manifestQ.isLoading || scansQ.isLoading;
  const copyMissing = async () => {
    const text = missingTrackingList(split.missing);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(L({ ku: "تراکی نەهاتووەکان کۆپی کرا", en: "Missing trackings copied", ar: "تم نسخ أرقام غير الواصلة", zh: "已复制未到运单号" }));
    } catch {
      toast.error(L({ ku: "کۆپی نەکرا", en: "Could not copy", ar: "تعذّر النسخ", zh: "复制失败" }));
    }
  };

  const who = (parcel: ManifestParcel) => (
    <span className="min-w-0 truncate text-xs text-muted-foreground">
      <bdi dir="ltr" className="font-mono font-semibold text-foreground">{parcel.customerCode || "—"}</bdi>
      {parcel.customerName ? ` · ${parcel.customerName}` : ""}
    </span>
  );
  const name = (parcel: ManifestParcel) => {
    const tracking = String(parcel.trackingNumber ?? "").trim();
    return (
      <span className="inline-flex items-center gap-1" dir="ltr">
        {tracking ? (
          <a href={parcelListHref(tracking)} className="font-mono text-sm font-medium underline-offset-2 hover:underline">
            {tracking}
          </a>
        ) : (
          <span className="font-mono text-sm">—</span>
        )}
        {tracking && <CopyButton value={tracking} />}
      </span>
    );
  };

  return (
    <Dialog open={!!batch} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent dir={isRTL ? "rtl" : "ltr"} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <History className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            {L({ ku: "وردەکاریی پشکنینی گەیشتن", en: "Arrival check, in detail", ar: "تفاصيل فحص الوصول", zh: "到货核对明细" })}
            <bdi dir="ltr" className="rounded-md border bg-muted px-2 py-0.5 font-mono text-xs">{batch?.batchCode}</bdi>
          </DialogTitle>
          <DialogDescription>
            {batch?.lastCheckedAt
              ? `${L({ ku: "دوایین پشکنین", en: "Last checked", ar: "آخر فحص", zh: "最近核对" })}: ${fmtWhen(batch.lastCheckedAt, true)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          // The direction is handed to the tabs outright: left to themselves
          // they are a left-to-right island, and every row inside one was
          // laid out backwards — the photograph on the far side from the
          // tracking it belongs to.
          <Tabs dir={isRTL ? "rtl" : "ltr"} defaultValue={split.missing.length > 0 ? "missing" : "arrived"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="missing" className="gap-2" data-testid="arrival-detail-missing-tab">
                <AlertTriangle className="h-4 w-4" />
                {L({ ku: "نەهاتوو", en: "Not arrived", ar: "لم يصل", zh: "未到" })} ({split.missing.length})
              </TabsTrigger>
              <TabsTrigger value="arrived" className="gap-2" data-testid="arrival-detail-arrived-tab">
                <CheckCircle2 className="h-4 w-4" />
                {L({ ku: "هاتوو", en: "Arrived", ar: "وصل", zh: "已到" })} ({split.arrived.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="missing" className="mt-3 space-y-2">
              {split.missing.length === 0 ? (
                <p className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                  {L({ ku: "هەموو پاکەتەکانی ئەم باچە گەیشتوون", en: "Every parcel of this batch arrived", ar: "وصلت كل طرود هذه الدفعة", zh: "该批次包裹已全部到达" })}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copyMissing} data-testid="arrival-detail-copy-missing">
                      <ClipboardCopy className="h-4 w-4" />
                      {L({ ku: "کۆپیکردنی هەموو تراکە نەهاتووەکان", en: "Copy all missing trackings", ar: "نسخ كل الأرقام غير الواصلة", zh: "复制全部未到运单号" })}
                    </Button>
                    {batch && (
                      <Button type="button" size="sm" className="gap-1.5" onClick={() => onContinue(batch)} data-testid="arrival-detail-continue">
                        <ScanLine className="h-4 w-4" />
                        {L({ ku: "بەردەوامبوون لە پشکنینی ئەم باچە", en: "Carry on checking this batch", ar: "متابعة فحص هذه الدفعة", zh: "继续核对此批次" })}
                      </Button>
                    )}
                  </div>
                  {split.missing.map((parcel) => (
                    <div
                      key={parcel.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-yellow-200 bg-yellow-50 p-2.5 dark:border-yellow-800/60 dark:bg-yellow-900/20"
                      data-testid="arrival-detail-missing-row"
                    >
                      <Thumb photo={parcel.photo ?? null} />
                      {name(parcel)}
                      {parcel.orderCode && <bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{parcel.orderCode}</bdi>}
                      <OrderNumbers numbers={parcel.orderNumbers ?? undefined} />
                      <span className="ms-auto">{who(parcel)}</span>
                    </div>
                  ))}
                </>
              )}
            </TabsContent>

            <TabsContent value="arrived" className="mt-3 space-y-2">
              {split.arrived.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {L({ ku: "هێشتا هیچ پاکەتێک پشکنینی بۆ نەکراوە", en: "No parcel has been checked in yet", ar: "لم يُفحص أي طرد بعد", zh: "尚未核对任何包裹" })}
                </p>
              ) : (
                split.arrived.map(({ parcel, checkedAt, checkedBy }) => (
                  <div
                    key={parcel.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                    data-testid="arrival-detail-arrived-row"
                  >
                    <Thumb photo={parcel.photo ?? null} />
                    {name(parcel)}
                    {who(parcel)}
                    <span className="ms-auto text-end text-[11px] text-muted-foreground">
                      {checkedAt && <bdi dir="ltr" className="font-mono">{fmtWhen(checkedAt, true)}</bdi>}
                      {checkedBy ? ` · ${checkedBy}` : ""}
                    </span>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Thumb({ photo }: { photo: string | null }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {photo ? (
        <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Package className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}
