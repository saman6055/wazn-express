import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Check, ChevronDown, Lock } from "lucide-react";
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
import { SettlementLoadError, NothingToTake } from "@/components/delivery/SettlementStates";
import { useSystemAlert } from "@/components/SystemAlert";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtNumber, fmtUsd } from "@/lib/portalFormat";
import { splitCustomerCode } from "@shared/customerCode";
import {
  settlementTotals, differenceOf, iqdToUsd, usdToIqd, allocateBoxDiscount,
  type ParcelIntent,
} from "@shared/boxSettlement";
import { pledgeFloors, reasonText } from "@shared/pledgedDiscount";
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

  const [undoing, setUndoing] = useState<number | null>(null);
  const [undoReason, setUndoReason] = useState("");

  const { data, isLoading, error, refetch } = trpc.deliveryBox.settlementView.useQuery(
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
  /**
   * Discounts already promised on a printed receipt.
   *
   * They are not a suggestion here: the paper is in the customer's hand, so
   * this screen shows them, takes them off the figure it asks for, and sends
   * them with the payment. Raising or changing one is the full payment
   * screen's business — one line down, under "the parcels".
   */
  const pledges = data?.pledges ?? [];
  const floors = useMemo(() => pledgeFloors(pledges), [pledges]);
  const boxCutByParcel = useMemo(
    () => allocateBoxDiscount(floors.boxUsd, parcels, []),
    [floors.boxUsd, parcels],
  );
  const intents: ParcelIntent[] = useMemo(
    () => parcels.map((p) => ({
      lineId: p.lineId,
      discountUsd: (floors.byLine.get(p.lineId) ?? 0) + (boxCutByParcel.get(p.lineId) ?? 0),
    })),
    [parcels, floors, boxCutByParcel],
  );
  const totals = useMemo(() => settlementTotals(parcels, intents), [parcels, intents]);

  /** What the receipt promised, in the words it promised them in. */
  /** Receipts still standing on this box — a reversed one took nothing. */
  const undo = trpc.deliveryBox.reverseSettlement.useMutation({
    onSuccess: () => {
      setUndoing(null);
      setUndoReason("");
      void refetch();
      toast.success(t({
        ku: "وەسڵەکە هەڵوەشێنرایەوە — پارەکە و داشکاندنەکە گەڕانەوە سەر حیساب",
        en: "Receipt undone — the payment and the discount are back on the account",
        ar: "تم إلغاء الإيصال — الدفعة والخصم عادا إلى الحساب",
        zh: "收据已撤销 — 款项与折扣已退回账户",
      }));
    },
    onError: (err) => systemAlert({
      kind: "error",
      title: t({
        ku: "هەڵنەوەشێنرایەوە",
        en: "Not undone",
        ar: "لم يُلغَ",
        zh: "未撤销",
      }),
      message: err.message,
    }),
  });

  const earlier = useMemo(
    () => (data?.settlements ?? []).filter((s) => s.status !== "reversed"),
    [data?.settlements],
  );

  const promised = useMemo(
    () =>
      [...pledges]
        .sort((a, b) => b.usd - a.usd)
        .filter((p, i, all) => {
          // One row per target, the largest — a reprinted receipt replaced
          // the one before it rather than promising both.
          const key = p.lineId ?? "box";
          return all.findIndex((o) => (o.lineId ?? "box") === key) === i;
        })
        .map((p) => ({
          usd: p.lineId === null ? floors.boxUsd : floors.byLine.get(p.lineId) ?? p.usd,
          what: p.trackingNumber ?? null,
          why: reasonText(p, language === "ku" || language === "ar" || language === "zh" ? language : "en"),
        })),
    [pledges, floors, language],
  );

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
      if (res.boxFinished) {
        toast.success(t({ ku: "بۆکسەکە گەیەنرا، داخرا و چووە ئەرشیف", en: "Box delivered, closed and archived", ar: "تم تسليم الصندوق وإغلاقه وأرشفته", zh: "箱子已交付、关闭并归档" }));
      } else if (res.finishError) {
        systemAlert({
          kind: "error",
          title: t({ ku: "پارەکە تۆمار کرا، بەڵام بۆکسەکە خۆکار نەگەیەنرا", en: "Payment saved, but the box was not closed automatically", ar: "تم حفظ الدفعة لكن الصندوق لم يُغلق تلقائيًا", zh: "付款已保存，但箱子未能自动关闭" }),
          message: res.finishError,
        });
      }
      // The whole box router: the list drops the paid box and pulls the
      // next one up into its place, and the counts follow.
      void utils.deliveryBox.invalidate();
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
      /**
       * The promised discounts go with the payment — each on the thing it
       * was promised on, and with the reason it was given for.
       *
       * A promise made on one parcel travels as that parcel's own discount;
       * one made on the box travels as the box's, and the server spreads it.
       * Folding the box one into the lines instead would look like the same
       * money and read as a broken promise, because the receipt named the
       * box.
       */
      lines: parcels.map((p) => {
        const pledged = pledges
          .filter((q) => q.lineId === p.lineId)
          .sort((a, b) => b.usd - a.usd)[0];
        const cut = floors.byLine.get(p.lineId) ?? 0;
        return {
          lineId: p.lineId,
          discountUsd: cut > 0 ? cut : undefined,
          discountReason: cut > 0 ? (pledged?.reason ?? "other") : undefined,
          discountNote: cut > 0 ? (pledged?.note ?? undefined) : undefined,
        };
      }),
      boxDiscount: floors.boxUsd > 0 ? { mode: "amount" as const, value: floors.boxUsd } : undefined,
      boxDiscountReason: floors.boxUsd > 0 ? (boxReason?.reason ?? "other") : undefined,
      boxDiscountNote: floors.boxUsd > 0 ? (boxReason?.note ?? undefined) : undefined,
      amountIqd: Number(iqd) || undefined,
      amountUsd: nothingEntered ? totals.dueUsd : (Number(usd) || undefined),
      exchangeRate: rateNum || undefined,
      treatShortAs,
      differenceReason: reason || undefined,
    });
  };

  /** The reason a box-wide promise was given for, for the parcels it is spread over. */
  const boxReason = pledges.filter((p) => p.lineId === null).sort((a, b) => b.usd - a.usd)[0] ?? null;

  const code = splitCustomerCode(data?.customer?.customerCode);
  // A failed load is not "nothing to pay": it says so, with its report.
  const nothingToPay = !isLoading && !error && parcels.length === 0;

  return (
    <>
    <Dialog open={boxId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className={cn(
          "transition-[max-width] duration-200",
          showParcels ? "max-w-5xl" : "max-w-md",
        )}
      >
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
        ) : error ? (
          <SettlementLoadError error={error} onRetry={() => void refetch()} />
        ) : nothingToPay ? (
          <NothingToTake view={data} />
        ) : (
          <div className="space-y-4">
            {/*
             * The one-press answer, and the whole of it.
             *
             * It steps aside when the parcels are opened: the full panel
             * below has the same figure, the same inputs and the same
             * button, and two of each in one window is what made this
             * screen unreadable (owner, 2026-09-24).
             */}
            {!showParcels && (
              <>
              {/*
               * The receipt that already took this money.
               *
               * The owner, 2026-09-26: "I cannot do the payment again and I
               * do not know why." Because a receipt exists and nothing on
               * this screen said so — the figure simply read zero. A box
               * whose money was handed back outside the receipt still counts
               * as paid until the receipt itself is undone, so the receipt is
               * named here, with the way to undo it, where the money is
               * taken. It is the same undo as the parcels panel below; it was
               * only ever one click too far away.
               */}
              {earlier.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/30"
                     data-testid="quick-earlier">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    {t({
                      ku: "ئەم بۆکسە پێشتر وەسڵی بۆ دەرکراوە",
                      en: "This box already has a receipt",
                      ar: "لهذا الصندوق إيصال سابق",
                      zh: "此箱已开具收据",
                    })}
                  </p>
                  {earlier.map((s) => (
                    <div key={s.id} className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
                      <bdi dir="ltr" className="font-mono">{s.settlementNumber}</bdi>
                      <bdi dir="ltr" className="font-mono">{fmtUsd(Number(s.paidUsd || 0))}</bdi>
                      {Number(s.discountUsd || 0) > 0 && (
                        <span className="text-amber-700 dark:text-amber-400">
                          {t({ ku: "داشکاندن", en: "discount", ar: "خصم", zh: "折扣" })}{" "}
                          <bdi dir="ltr" className="font-mono">{fmtUsd(Number(s.discountUsd || 0))}</bdi>
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ms-auto h-6 px-2 text-xs text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950"
                        onClick={() => { setUndoing(s.id); setUndoReason(""); }}
                        data-testid={`quick-undo-${s.id}`}
                      >
                        {t({ ku: "هەڵوەشاندنەوە", en: "Undo", ar: "إلغاء", zh: "撤销" })}
                      </Button>
                    </div>
                  ))}
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                    {t({
                      ku: "تا وەسڵەکە هەڵنەوەشێنرێتەوە، ئەم بۆکسە بە پارەدراو دەژمێردرێت — هەڵوەشاندنەوەی پارەکە و داشکاندنەکە پێکەوە دەگەڕێنێتەوە.",
                      en: "Until the receipt is undone this box counts as paid — undoing it puts back the payment and the discount together.",
                      ar: "يُعتبر الصندوق مدفوعاً حتى يُلغى الإيصال — والإلغاء يعيد الدفعة والخصم معاً.",
                      zh: "在撤销收据之前，此箱视为已付 — 撤销会同时退回款项与折扣。",
                    })}
                  </p>
                </div>
              )}

              {/* Who, and how much. Nothing else above the fold. */}
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono" dir="ltr">{code.code}</span>
                  {code.name ? ` · ${code.name}` : ""}
                </p>
                <p className="mt-1 font-mono text-4xl font-semibold tabular-nums" data-testid="quick-due">
                  {fmtUsd(totals.dueUsd)}
                </p>
                {rateNum > 0 && (
                  <p className="mt-1 font-mono text-sm text-muted-foreground" dir="ltr">
                    {fmtNumber(usdToIqd(totals.dueUsd, rateNum), 0)} IQD
                  </p>
                )}
                {promised.length > 0 && (
                  <div
                    className="mt-3 space-y-1 border-t pt-2 text-start"
                    data-testid="quick-pledged"
                  >
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <Lock className="h-3.5 w-3.5" />
                      {t({
                        ku: "داشکاندنی لەسەر وەسڵ چاپکراو — لە ژمارەکەی سەرەوە کەم کراوەتەوە",
                        en: "Discount printed on the receipt — already off the figure above",
                        ar: "خصم مطبوع على الإيصال — مخصوم من المبلغ أعلاه",
                        zh: "收据上已打印的折扣 — 已从上方金额中扣除",
                      })}
                    </p>
                    {promised.map((p, i) => (
                      <p key={i} className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                        <span className="min-w-0">
                          {p.what && (
                            <bdi dir="ltr" className="font-mono">{p.what}</bdi>
                          )}
                          {p.what && p.why ? " · " : ""}
                          {p.why}
                        </span>
                        <bdi dir="ltr" className="font-mono text-amber-700 dark:text-amber-400">
                          −{fmtUsd(p.usd)}
                        </bdi>
                      </p>
                    ))}
                  </div>
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
                  {" "}{fmtUsd(difference.amountUsd)} —{" "}
                  {t({ ku: "دەبێتە کریدیت لەسەر کڕیار", en: "becomes credit on the customer", ar: "يصبح رصيداً للعميل", zh: "转为客户余额" })}
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border border-red-300 p-3 dark:border-red-800">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {t({ ku: "کەمە بە", en: "Short by", ar: "ناقص", zh: "少付" })}
                {" "}{fmtUsd(difference.amountUsd)}
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
              </>
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

        {!isLoading && !error && !nothingToPay && !showParcels && (
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
              {" — "}{fmtUsd(paid)}
            </Button>
          </DialogFooter>
        )}

        {/* The full machinery, when it is genuinely wanted. */}
        {showParcels && boxId !== null && (
          <div className="-mx-1 max-h-[72vh] overflow-y-auto px-1">
            <BoxSettlementPanel
              boxId={boxId}
              embedded
              onSettled={() => { onOpenChange(false); onSettled?.(); }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>

      {/*
       * Undoing a receipt is never a slip: the reason is printed into the
       * ledger row that puts the money back, so the account can later say
       * why the debt reappeared.
       */}
      <Dialog open={undoing !== null} onOpenChange={(o) => !o && setUndoing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t({
                ku: "هەڵوەشاندنەوەی وەسڵ",
                en: "Undo the receipt",
                ar: "إلغاء الإيصال",
                zh: "撤销收据",
              })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t({
              ku: "پارەکە و داشکاندنەکە پێکەوە دەگەڕێنەوە سەر حیسابی کڕیار، و بۆکسەکە دێتەوە بۆ پارەدان.",
              en: "The payment and the discount both go back onto the customer's account, and the box is payable again.",
              ar: "تعود الدفعة والخصم إلى حساب الزبون، ويصبح الصندوق قابلاً للدفع مجدداً.",
              zh: "款项与折扣将一同退回客户账户，此箱可再次收款。",
            })}
          </p>
          <Textarea
            value={undoReason}
            onChange={(e) => setUndoReason(e.target.value)}
            rows={2}
            placeholder={t({
              ku: "هۆکار — بۆچی هەڵدەوەشێنرێتەوە؟",
              en: "Reason — why is it being undone?",
              ar: "السبب — لماذا يُلغى؟",
              zh: "原因 — 为何撤销？",
            })}
            data-testid="quick-undo-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndoing(null)}>
              {t({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </Button>
            <Button
              variant="destructive"
              disabled={undoReason.trim().length < 3 || undo.isPending}
              onClick={() => undo.mutate({ settlementId: undoing!, reason: undoReason.trim() })}
              data-testid="quick-undo-confirm"
            >
              {undo.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t({ ku: "هەڵوەشاندنەوە", en: "Undo", ar: "إلغاء", zh: "撤销" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
