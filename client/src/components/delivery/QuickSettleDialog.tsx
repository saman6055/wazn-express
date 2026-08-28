import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GroupedNumberInput } from "@/components/expenses/GroupedNumberInput";
import { BoxSettlementPanel } from "@/components/delivery/BoxSettlementPanel";
import { useSystemAlert } from "@/components/SystemAlert";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { splitCustomerCode } from "@shared/customerCode";
import { settlementTotals, differenceOf, iqdToUsd, usdToIqd } from "@shared/boxSettlement";
import { cn } from "@/lib/utils";

/**
 * Taking the money for a box, in one press.
 *
 * The box reached the customer, the customer paid for it, and that is nearly
 * always the whole story: parcels rarely have anything wrong with them and
 * the full amount comes back. So this asks one question — how much was
 * received — with the answer already filled in, and settles.
 *
 * The first version of this screen led with the machinery for the rare day:
 * a row per parcel, each with a hold button, a correction and a discount of
 * its own. All of that still exists, and none of it belongs in front of
 * somebody doing this forty times an afternoon. It is one line away, under
 * "the parcels", for the day a parcel is actually in dispute.
 */

interface Props {
  boxId: number | null;
  onOpenChange: (open: boolean) => void;
  onSettled?: () => void;
}

export function QuickSettleDialog({ boxId, onOpenChange, onSettled }: Props) {
  const { language } = useTranslation();
  const systemAlert = useSystemAlert();
  const utils = trpc.useUtils();

  const [iqd, setIqd] = useState("");
  const [rate, setRate] = useState("");
  const [usd, setUsd] = useState("");
  const [treatShortAs, setTreatShortAs] = useState<"debt" | "discount">("debt");
  const [reason, setReason] = useState("");
  const [showParcels, setShowParcels] = useState(false);

  const t = (k: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, k);

  const { data, isLoading } = trpc.deliveryBox.settlementView.useQuery(
    { boxId: boxId ?? 0 },
    { enabled: boxId !== null },
  );

  // Fresh state each time a box is opened; the last box's figures must not
  // be sitting in the boxes of the next one.
  useEffect(() => {
    setIqd(""); setUsd(""); setReason(""); setTreatShortAs("debt"); setShowParcels(false);
  }, [boxId]);

  useEffect(() => {
    if (data?.lastExchangeRate) setRate(String(data.lastExchangeRate));
  }, [data?.lastExchangeRate]);

  const parcels = useMemo(
    () => (data?.parcels ?? []).filter((p) => p.outstandingUsd > 0 || p.notChargedYet),
    [data],
  );
  const totals = useMemo(() => settlementTotals(parcels), [parcels]);

  const rateNum = Number(rate) || 0;
  const nothingEntered = !iqd && !usd;
  const paid = nothingEntered
    ? totals.dueUsd
    : Math.round((iqdToUsd(Number(iqd) || 0, rateNum) + (Number(usd) || 0)) * 100) / 100;
  const difference = differenceOf(totals.dueUsd, paid, treatShortAs);
  const needsReason = difference.reasonRequired && !reason.trim();

  const settle = trpc.deliveryBox.settle.useMutation({
    onSuccess: (res) => {
      toast.success(
        `${t({ ku: "واصڵ کرا", en: "Settled", ar: "تم الاستلام", zh: "已结清" })} — ${res.settlementNumber}`,
      );
      utils.deliveryBox.settlementView.invalidate();
      utils.deliveryBox.customerSummary.invalidate();
      onOpenChange(false);
      onSettled?.();
    },
    onError: (err) => {
      // The money door: a refusal has to be read, not glimpsed in a corner.
      systemAlert({
        kind: "error",
        title: t({ ku: "واصڵ نەکرا", en: "Not settled", ar: "لم يتم الاستلام", zh: "未结清" }),
        message: err.message,
      });
    },
  });

  const submit = () => {
    if (!boxId) return;
    settle.mutate({
      boxId,
      lines: parcels.map((p) => ({ packageId: p.packageId })),
      amountIqd: Number(iqd) || undefined,
      amountUsd: nothingEntered ? totals.dueUsd : (Number(usd) || undefined),
      exchangeRate: rateNum || undefined,
      treatShortAs,
      differenceReason: reason || undefined,
    });
  };

  const code = splitCustomerCode(data?.customer?.customerCode);
  const nothingToPay = !isLoading && parcels.length === 0;

  return (
    <Dialog open={boxId !== null} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-2">
            {t({ ku: "پارەدان", en: "Take payment", ar: "استلام المبلغ", zh: "收款" })}
            {data?.box && (
              <span className="font-mono text-sm font-normal text-muted-foreground" dir="ltr">
                {data.box.boxCode}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t({ ku: "بارکردن…", en: "Loading…", ar: "جارٍ التحميل…", zh: "加载中…" })}
          </div>
        ) : nothingToPay ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t({
              ku: "هیچ پارەیەکی ماوە نییە لەم بۆکسە",
              en: "Nothing outstanding on this box",
              ar: "لا يوجد مبلغ مستحق على هذا الصندوق",
              zh: "此箱无未结款项",
            })}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Who, and how much. Nothing else above the fold. */}
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                <span className="font-mono" dir="ltr">{code.code}</span>
                {code.name ? ` · ${code.name}` : ""}
              </p>
              <p className="mt-1 font-mono text-4xl font-semibold tabular-nums" data-testid="quick-due">
                ${totals.dueUsd.toFixed(2)}
              </p>
              {rateNum > 0 && (
                <p className="mt-1 font-mono text-sm text-muted-foreground" dir="ltr">
                  {usdToIqd(totals.dueUsd, rateNum).toLocaleString()} IQD
                </p>
              )}
            </div>


            {/* One question: how much came back. Already answered. */}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">
              {t({ ku: "وەرگیراو بە دینار", en: "Received in dinars", ar: "المستلم بالدينار", zh: "收到（第纳尔）" })}
                </span>
                <GroupedNumberInput
              value={iqd} onValueChange={setIqd} className="h-10"
              placeholder={rateNum > 0 ? String(usdToIqd(totals.dueUsd, rateNum)) : ""}
              data-testid="quick-iqd"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">
              {t({ ku: "نرخی دۆلار", en: "Dollar rate", ar: "سعر الدولار", zh: "美元汇率" })}
                </span>
                <GroupedNumberInput value={rate} onValueChange={setRate} className="h-10"
                                data-testid="quick-rate" />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">
                {t({ ku: "یان بە دۆلار", en: "Or in dollars", ar: "أو بالدولار", zh: "或美元" })}
              </span>
              <GroupedNumberInput value={usd} onValueChange={setUsd} className="h-10"
                              data-testid="quick-usd" />
            </label>

            {/* Only when the money is not the money. */}
            {difference.kind === "none" ? (
              <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
                 data-testid="quick-exact">
                <Check className="h-4 w-4" />
                {t({ ku: "پارەکە تەواوە", en: "Paid in full", ar: "مدفوع بالكامل", zh: "已全额支付" })}
              </p>
            ) : difference.kind === "credit" ? (
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {t({ ku: "زیادە", en: "Over", ar: "زائد", zh: "多付" })}
                {" "}${difference.amountUsd.toFixed(2)} —{" "}
                {t({ ku: "دەبێتە کریدیت لەسەر کڕیار", en: "becomes credit on the customer", ar: "يصبح رصيداً للعميل", zh: "转为客户余额" })}
              </p>
            ) : (
              <div className="space-y-2 rounded-lg border border-red-300 p-3 dark:border-red-800">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {t({ ku: "کەمە بە", en: "Short by", ar: "ناقص", zh: "少付" })}
              {" "}${difference.amountUsd.toFixed(2)}
                </p>
                <Select value={treatShortAs} onValueChange={(v) => setTreatShortAs(v as "debt" | "discount")}>
              <SelectTrigger className="h-9" data-testid="quick-short-as"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="debt">
                  {t({ ku: "قەرز لەسەر کڕیار", en: "Debt on the customer", ar: "دين على العميل", zh: "记为欠款" })}
                </SelectItem>
                <SelectItem value="discount">
                  {t({ ku: "داشکاندن", en: "Written off", ar: "خصم", zh: "折扣核销" })}
                </SelectItem>
              </SelectContent>
                </Select>
                <Textarea
              value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              className={cn("text-sm", needsReason && "border-red-400 dark:border-red-700")}
              placeholder={t({ ku: "هۆکار — داواکراوە", en: "Reason — required", ar: "السبب — مطلوب", zh: "原因——必填" })}
              data-testid="quick-reason"
                />
              </div>
            )}

            {/* One line, for the day a parcel is actually in dispute. */}
            <button
              type="button"
              onClick={() => setShowParcels((v) => !v)}
              className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              data-testid="quick-show-parcels"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showParcels && "rotate-180")} />
              {t({
                ku: "پارسێلەکان — داشکاندن، ڕاستکردنەوە، تەحدید",
                en: "The parcels — discount, correction, set aside",
                ar: "الطرود — خصم، تصحيح، استبعاد",
                zh: "包裹——折扣、更正、搁置",
              })}
            </button>
          </div>
        )}

        {!isLoading && !nothingToPay && !showParcels && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </Button>
            <Button
              onClick={submit}
              disabled={needsReason || settle.isPending}
              data-testid="quick-settle"
            >
              {settle.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t({ ku: "واصڵکردن", en: "Take payment", ar: "استلام", zh: "收款" })}
              {" — $"}{paid.toFixed(2)}
            </Button>
          </DialogFooter>
        )}

        {/* The full machinery, when it is genuinely wanted. */}
        {showParcels && boxId !== null && (
          <div className="-mx-2 max-h-[60vh] overflow-y-auto">
            <BoxSettlementPanel
              boxId={boxId}
              onSettled={() => { onOpenChange(false); onSettled?.(); }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
