import { useMemo, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Wallet, Percent, Pencil, Ban, RotateCcw, AlertTriangle, Check, Loader2, Undo2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GroupedNumberInput } from "@/components/expenses/GroupedNumberInput";
import { useSystemAlert } from "@/components/SystemAlert";
import { showErrorToast } from "@/lib/errorToast";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import {
  settlementTotals, differenceOf, boxDiscountUsd, allocateBoxDiscount,
  iqdToUsd, usdToIqd,
  type ParcelIntent, type BoxDiscount, type DiscountReason,
} from "@shared/boxSettlement";

/**
 * Taking the money, at the counter, with the parcels in front of both people.
 *
 * The rule this screen is built around is that the exceptions must not tax
 * the ordinary day. A box is $900, $900 comes back, and nothing here asks a
 * question: every parcel is already ticked, the amount is already filled in,
 * and there is one button. Discounts, corrections, holds and reasons all stay
 * out of the way until the day is not that one — and then each of them
 * insists on a reason, because a figure with no reason beside it is a figure
 * nobody can check a month later.
 *
 * Every number shown is computed by the same shared functions the server uses
 * to decide what to write. The screen cannot show one total and save another.
 */

type Lang = string | undefined;

const REASON_LABELS: Record<DiscountReason, { ku: string; en: string; ar: string; zh: string }> = {
  damaged: { ku: "شکاون یان زیانیان پێگەیشتووە", en: "Damaged in transit", ar: "تضرر أثناء النقل", zh: "运输中损坏" },
  late: { ku: "دواکەوتن لە گەیاندن", en: "Late delivery", ar: "تأخر في التسليم", zh: "延迟送达" },
  goodwill: { ku: "هاندان و ستایش", en: "Goodwill", ar: "مجاملة", zh: "友好折扣" },
  loyal: { ku: "کڕیاری باش", en: "Loyal customer", ar: "عميل مميز", zh: "老客户" },
  rounding: { ku: "خڕکردنەوەی دینار", en: "Dinar rounding", ar: "تقريب الدينار", zh: "第纳尔取整" },
  other: { ku: "هۆکارێکی تر", en: "Other", ar: "سبب آخر", zh: "其他" },
};

const money = (n: number) => `$${n.toFixed(2)}`;

interface Props {
  boxId: number;
  /** Refresh the box list when money moves. */
  onSettled?: () => void;
}

export function BoxSettlementPanel({ boxId, onSettled }: Props) {
  const { language } = useTranslation();
  const systemAlert = useSystemAlert();
  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.deliveryBox.settlementView.useQuery({ boxId });

  const [held, setHeld] = useState<Record<number, string>>({});
  const [corrections, setCorrections] = useState<Record<number, { amount: string; reason: string }>>({});
  const [lineDiscounts, setLineDiscounts] = useState<Record<number, { amount: string; reason: DiscountReason }>>({});

  const [discountMode, setDiscountMode] = useState<BoxDiscount["mode"]>("none");
  const [discountValue, setDiscountValue] = useState("");
  const [fromRate, setFromRate] = useState("");
  const [toRate, setToRate] = useState("");
  const [discountReason, setDiscountReason] = useState<DiscountReason>("goodwill");
  const [discountNote, setDiscountNote] = useState("");

  const [iqd, setIqd] = useState("");
  const [rate, setRate] = useState("");
  const [usd, setUsd] = useState("");
  const [treatShortAs, setTreatShortAs] = useState<"debt" | "discount">("debt");
  const [differenceReason, setDifferenceReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reversing, setReversing] = useState<number | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  const t = (k: { ku: string; en: string; ar: string; zh: string }) => pickLang(language as Lang, k);

  const parcels = useMemo(
    () => (data?.parcels ?? []).filter((p) => p.outstandingUsd > 0 || p.notChargedYet),
    [data],
  );

  // The rate the last settlement used. The dollar sits still for a week at a
  // time here, so pre-filling it means the ordinary day needs no typing.
  useEffect(() => {
    if (!rate && data?.lastExchangeRate) setRate(String(data.lastExchangeRate));
  }, [data?.lastExchangeRate, rate]);

  const boxDiscount: BoxDiscount = useMemo(() => {
    if (discountMode === "perKg") {
      return { mode: "perKg", fromRatePerKg: Number(fromRate) || 0, toRatePerKg: Number(toRate) || 0 };
    }
    if (discountMode === "none") return { mode: "none" };
    return { mode: discountMode, value: Number(discountValue) || 0 };
  }, [discountMode, discountValue, fromRate, toRate]);

  const boxCut = useMemo(() => boxDiscountUsd(boxDiscount, parcels), [boxDiscount, parcels]);
  const heldIds = useMemo(() => Object.keys(held).map(Number), [held]);
  const cutByParcel = useMemo(
    () => allocateBoxDiscount(boxCut, parcels, heldIds),
    [boxCut, parcels, heldIds],
  );

  const intents: ParcelIntent[] = useMemo(
    () => parcels.map((p) => ({
      packageId: p.packageId,
      held: p.packageId in held,
      correctionUsd: Number(corrections[p.packageId]?.amount || 0),
      discountUsd: Number(lineDiscounts[p.packageId]?.amount || 0) + (cutByParcel.get(p.packageId) ?? 0),
    })),
    [parcels, held, corrections, lineDiscounts, cutByParcel],
  );

  const totals = useMemo(() => settlementTotals(parcels, intents), [parcels, intents]);

  const rateNum = Number(rate) || 0;
  const paidUsd = useMemo(
    () => Math.round((iqdToUsd(Number(iqd) || 0, rateNum) + (Number(usd) || 0)) * 100) / 100,
    [iqd, rateNum, usd],
  );
  // Nothing typed yet means the customer is paying in full — the ordinary day.
  const nothingEntered = !iqd && !usd;
  const effectivePaid = nothingEntered ? totals.dueUsd : paidUsd;
  const difference = useMemo(
    () => differenceOf(totals.dueUsd, effectivePaid, treatShortAs),
    [totals.dueUsd, effectivePaid, treatShortAs],
  );

  const settle = trpc.deliveryBox.settle.useMutation({
    onSuccess: (res) => {
      toast.success(
        `${t({ ku: "واصڵ کرا", en: "Settled", ar: "تم الاستلام", zh: "已结清" })} — ${res.settlementNumber}`,
      );
      setConfirmOpen(false);
      setHeld({}); setCorrections({}); setLineDiscounts({});
      setDiscountMode("none"); setDiscountValue(""); setFromRate(""); setToRate("");
      setIqd(""); setUsd(""); setDifferenceReason("");
      refetch();
      utils.deliveryBox.customerSummary.invalidate();
      onSettled?.();
    },
    onError: (err) => {
      setConfirmOpen(false);
      // The blocking dialog, not a toast: this is the money door, and a
      // refusal here is something the operator has to read before carrying on.
      systemAlert({
        kind: "error",
        title: t({ ku: "واصڵ نەکرا", en: "Not settled", ar: "لم يتم الاستلام", zh: "未结清" }),
        message: err.message,
      });
    },
  });

  const reverse = trpc.deliveryBox.reverseSettlement.useMutation({
    onSuccess: () => {
      toast.success(t({ ku: "هەڵوەشێنرایەوە", en: "Reversed", ar: "تم الإلغاء", zh: "已撤销" }));
      setReversing(null); setReversalReason("");
      refetch();
      utils.deliveryBox.customerSummary.invalidate();
      onSettled?.();
    },
    onError: (err) => showErrorToast(err, "reverseSettlement"),
  });

  if (isLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t({ ku: "بارکردن…", en: "Loading…", ar: "جارٍ التحميل…", zh: "加载中…" })}
      </CardContent></Card>
    );
  }
  if (!data?.box) return null;

  const notCharged = parcels.filter((p) => p.notChargedYet && !(p.packageId in held));
  const blocked = notCharged.length > 0;
  const needsReason = difference.reasonRequired && !differenceReason.trim();
  const discountNeedsReason = boxCut > 0 && !discountReason;
  const canSettle = !blocked && !needsReason && !discountNeedsReason && parcels.length > 0;

  const toggleHold = (packageId: number) => {
    setHeld((h) => {
      const next = { ...h };
      if (packageId in next) delete next[packageId];
      else next[packageId] = "";
      return next;
    });
  };

  const submit = () => {
    settle.mutate({
      boxId,
      lines: parcels.map((p) => ({
        packageId: p.packageId,
        held: p.packageId in held,
        heldReason: held[p.packageId] || undefined,
        correctionUsd: Number(corrections[p.packageId]?.amount || 0) || undefined,
        correctionReason: corrections[p.packageId]?.reason || undefined,
        discountUsd: Number(lineDiscounts[p.packageId]?.amount || 0) || undefined,
        discountReason: lineDiscounts[p.packageId]?.reason,
      })),
      boxDiscount: boxCut > 0 ? boxDiscount : undefined,
      boxDiscountReason: boxCut > 0 ? discountReason : undefined,
      boxDiscountNote: discountNote || undefined,
      amountIqd: Number(iqd) || undefined,
      amountUsd: nothingEntered ? totals.dueUsd : (Number(usd) || undefined),
      exchangeRate: rateNum || undefined,
      treatShortAs,
      differenceReason: differenceReason || undefined,
    });
  };

  return (
    <Card data-testid="box-settlement">
      <CardContent className="space-y-4 pt-6">

        {/* ── who and how much ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50">
            <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">
              {t({ ku: "واصڵکردنی پارە", en: "Take payment", ar: "استلام المبلغ", zh: "收款" })}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {data.customer?.customerCode} · {data.box.boxCode}
            </p>
          </div>
          {data.accountBalanceUsd !== 0 && (
            <Badge variant={data.accountBalanceUsd > 0 ? "destructive" : "secondary"}>
              {data.accountBalanceUsd > 0
                ? t({ ku: "قەرز", en: "Owes", ar: "مدين", zh: "欠款" })
                : t({ ku: "کریدیت", en: "Credit", ar: "رصيد", zh: "余额" })}
              {" "}{money(Math.abs(data.accountBalanceUsd))}
            </Badge>
          )}
        </div>

        {blocked && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              {t({
                ku: `${notCharged.length} پارسێل هێشتا پارەیان نەچووەتە سەر کڕیار — باچەکەیان نەگەیشتووە. تەحدیدیان بکە یان دوایی واصڵیان بکە.`,
                en: `${notCharged.length} parcel(s) have not been charged yet — their batch has not been delivered. Set them aside, or settle them later.`,
                ar: `${notCharged.length} طرد لم يُحمّل على العميل بعد — لم تصل دفعته. استبعدها أو استلمها لاحقاً.`,
                zh: `${notCharged.length} 件包裹尚未计费——所属批次未送达。请先搁置或稍后结算。`,
              })}
            </p>
          </div>
        )}

        {/* ── the parcels ──────────────────────────────────────────── */}
        {parcels.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t({ ku: "هیچ پارەیەکی ماوە نییە لەم بۆکسە", en: "Nothing outstanding on this box", ar: "لا يوجد مبلغ مستحق على هذا الصندوق", zh: "此箱无未结款项" })}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="p-2 text-start font-medium">{t({ ku: "پارسێل", en: "Parcel", ar: "الطرد", zh: "包裹" })}</th>
                  <th className="p-2 text-end font-medium">{t({ ku: "بارکراو", en: "Charged", ar: "محمّل", zh: "已计费" })}</th>
                  <th className="p-2 text-end font-medium">{t({ ku: "ڕاستکردنەوە", en: "Correction", ar: "تصحيح", zh: "更正" })}</th>
                  <th className="p-2 text-end font-medium">{t({ ku: "داشکاندن", en: "Discount", ar: "خصم", zh: "折扣" })}</th>
                  <th className="p-2 text-end font-medium">{t({ ku: "دەدرێت", en: "To pay", ar: "المطلوب", zh: "应付" })}</th>
                  <th className="p-2 text-center font-medium">{t({ ku: "دۆخ", en: "State", ar: "الحالة", zh: "状态" })}</th>
                </tr>
              </thead>
              <tbody>
                {totals.lines.map((line) => {
                  const parcel = parcels.find((p) => p.packageId === line.packageId)!;
                  const isHeld = line.held;
                  return (
                    <tr
                      key={line.packageId}
                      className={cn("border-b last:border-0", isHeld && "bg-red-50 dark:bg-red-950/30")}
                      data-testid={`settle-row-${line.packageId}`}
                    >
                      <td className="p-2">
                        <span className="font-mono text-xs" dir="ltr">
                          {parcel.trackingNumber || parcel.packageCode}
                        </span>
                        {parcel.notChargedYet && (
                          <span className="mt-0.5 block text-xs text-amber-600 dark:text-amber-400">
                            {t({ ku: "هێشتا بار نەکراوە", en: "Not charged yet", ar: "لم يُحمّل بعد", zh: "尚未计费" })}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-end font-mono tabular-nums">{line.chargedUsd.toFixed(2)}</td>
                      <td className="p-2 text-end font-mono tabular-nums">
                        {line.correctionUsd !== 0
                          ? <span className={line.correctionUsd < 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}>
                              {line.correctionUsd > 0 ? "+" : ""}{line.correctionUsd.toFixed(2)}
                            </span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2 text-end font-mono tabular-nums">
                        {line.discountUsd > 0
                          ? <span className="text-amber-600 dark:text-amber-400">−{line.discountUsd.toFixed(2)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2 text-end font-mono tabular-nums font-semibold">
                        {isHeld
                          ? <span className="text-red-600 dark:text-red-400">0.00</span>
                          : <span className="text-emerald-600 dark:text-emerald-400">{line.paidUsd.toFixed(2)}</span>}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button" variant="ghost" size="sm" className="h-7 px-2"
                            onClick={() => toggleHold(line.packageId)}
                            data-testid={`settle-hold-${line.packageId}`}
                            title={t({ ku: "تەحدید", en: "Set aside", ar: "استبعاد", zh: "搁置" })}
                          >
                            {isHeld ? <Undo2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── the discount, given on the box ───────────────────────── */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium">
              {t({ ku: "داشکاندن لەسەر بۆکس", en: "Discount on the box", ar: "خصم على الصندوق", zh: "整箱折扣" })}
            </span>
            <Select value={discountMode} onValueChange={(v) => setDiscountMode(v as BoxDiscount["mode"])}>
              <SelectTrigger className="h-8 w-auto min-w-[10rem]" data-testid="settle-discount-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t({ ku: "بێ داشکاندن", en: "No discount", ar: "بدون خصم", zh: "无折扣" })}</SelectItem>
                <SelectItem value="newTotal">{t({ ku: "کۆی نوێ", en: "New total", ar: "الإجمالي الجديد", zh: "新总额" })}</SelectItem>
                <SelectItem value="amount">{t({ ku: "بڕی داشکاندن", en: "Amount off", ar: "مبلغ الخصم", zh: "折扣金额" })}</SelectItem>
                <SelectItem value="perKg">{t({ ku: "نرخی کیلۆ", en: "Rate per kg", ar: "سعر الكيلو", zh: "每公斤单价" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {discountMode !== "none" && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {discountMode === "perKg" ? (
                <>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t({ ku: "لە", en: "From", ar: "من", zh: "从" })}</span>
                    <GroupedNumberInput value={fromRate} onValueChange={setFromRate} placeholder="11" className="h-9" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t({ ku: "بۆ", en: "To", ar: "إلى", zh: "到" })}</span>
                    <GroupedNumberInput value={toRate} onValueChange={setToRate} placeholder="10" className="h-9" data-testid="settle-to-rate" />
                  </label>
                </>
              ) : (
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {discountMode === "newTotal"
                      ? t({ ku: "کۆی گشتی ببێتە", en: "Make the total", ar: "اجعل الإجمالي", zh: "总额改为" })
                      : t({ ku: "بڕ", en: "Amount", ar: "المبلغ", zh: "金额" })}
                  </span>
                  <GroupedNumberInput value={discountValue} onValueChange={setDiscountValue} className="h-9" data-testid="settle-discount-value" />
                </label>
              )}
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">{t({ ku: "هۆکار", en: "Reason", ar: "السبب", zh: "原因" })}</span>
                <Select value={discountReason} onValueChange={(v) => setDiscountReason(v as DiscountReason)}>
                  <SelectTrigger className="h-9" data-testid="settle-discount-reason"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REASON_LABELS) as DiscountReason[]).map((r) => (
                      <SelectItem key={r} value={r}>{t(REASON_LABELS[r])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {boxCut > 0 && (
                <p className="self-end text-sm text-amber-600 dark:text-amber-400 lg:col-span-3">
                  −{money(boxCut)} {t({ ku: "بەسەر پارسێلەکاندا دابەش دەکرێت", en: "spread across the parcels", ar: "موزع على الطرود", zh: "分摊到各包裹" })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── totals and the money ─────────────────────────────────── */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3 space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t({ ku: "حیسابی پارسێلەکان", en: "The parcels", ar: "حساب الطرود", zh: "包裹合计" })}
            </p>
            <Row label={t({ ku: "کۆی بارکراو", en: "Charged", ar: "المحمّل", zh: "已计费" })} value={totals.chargedUsd.toFixed(2)} />
            {totals.correctionUsd !== 0 && (
              <Row label={t({ ku: "ڕاستکردنەوە", en: "Corrections", ar: "التصحيحات", zh: "更正" })}
                   value={`${totals.correctionUsd > 0 ? "+" : ""}${totals.correctionUsd.toFixed(2)}`} tone="blue" />
            )}
            {totals.discountUsd > 0 && (
              <Row label={t({ ku: "داشکاندن", en: "Discount", ar: "الخصم", zh: "折扣" })}
                   value={`−${totals.discountUsd.toFixed(2)}`} tone="amber" />
            )}
            {totals.heldUsd > 0 && (
              <Row label={t({ ku: "تەحدید کراو", en: "Set aside", ar: "مستبعد", zh: "已搁置" })}
                   value={`−${totals.heldUsd.toFixed(2)}`} tone="red" />
            )}
            <div className="flex items-baseline justify-between border-t pt-1.5 font-semibold">
              <span>{t({ ku: "پێویستە بدرێت", en: "Due", ar: "المطلوب", zh: "应付" })}</span>
              <span className="font-mono tabular-nums" data-testid="settle-due">{money(totals.dueUsd)}</span>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t({ ku: "وەرگرتن", en: "Received", ar: "المستلم", zh: "已收" })}
            </p>
            <label className="space-y-1 block">
              <span className="text-xs text-muted-foreground">{t({ ku: "بە دینار", en: "In dinars", ar: "بالدينار", zh: "第纳尔" })}</span>
              <GroupedNumberInput value={iqd} onValueChange={setIqd} className="h-9"
                placeholder={rateNum > 0 ? String(usdToIqd(totals.dueUsd, rateNum)) : ""}
                data-testid="settle-iqd" />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs text-muted-foreground">{t({ ku: "نرخی دۆلار", en: "Dollar rate", ar: "سعر الدولار", zh: "美元汇率" })}</span>
              <GroupedNumberInput value={rate} onValueChange={setRate} className="h-9" data-testid="settle-rate" />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs text-muted-foreground">{t({ ku: "بە دۆلار", en: "In dollars", ar: "بالدولار", zh: "美元" })}</span>
              <GroupedNumberInput value={usd} onValueChange={setUsd} className="h-9" data-testid="settle-usd" />
            </label>
            <div className="flex items-baseline justify-between border-t pt-1.5 text-sm">
              <span className="text-muted-foreground">{t({ ku: "یەکسانە بە", en: "Comes to", ar: "يعادل", zh: "折合" })}</span>
              <span className="font-mono tabular-nums font-semibold">{money(effectivePaid)}</span>
            </div>
          </div>

          <div className={cn(
            "rounded-lg border p-3 space-y-2",
            difference.kind === "none" && "border-emerald-300 dark:border-emerald-800",
            difference.kind === "debt" && "border-red-300 dark:border-red-800",
            difference.kind === "credit" && "border-blue-300 dark:border-blue-800",
            difference.kind === "discount" && "border-amber-300 dark:border-amber-800",
          )}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t({ ku: "جیاوازی", en: "Difference", ar: "الفرق", zh: "差额" })}
            </p>
            {difference.kind === "none" ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span data-testid="settle-exact">
                  {t({ ku: "ڕێکە — هیچ هۆکارێک ناوێت", en: "Exact — no reason needed", ar: "مطابق — لا حاجة لسبب", zh: "正好——无需说明" })}
                </span>
              </div>
            ) : (
              <>
                <p className="font-mono text-lg font-semibold tabular-nums">
                  {difference.kind === "credit" ? "+" : "−"}{money(difference.amountUsd)}
                </p>
                {difference.kind === "credit" ? (
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    {t({ ku: "دەبێتە کریدیت لەسەر کڕیار", en: "Becomes credit on the customer", ar: "يصبح رصيداً للعميل", zh: "转为客户余额" })}
                  </p>
                ) : (
                  <>
                    <Select value={treatShortAs} onValueChange={(v) => setTreatShortAs(v as "debt" | "discount")}>
                      <SelectTrigger className="h-8" data-testid="settle-short-as"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debt">{t({ ku: "قەرز لەسەر کڕیار", en: "Debt on the customer", ar: "دين على العميل", zh: "记为欠款" })}</SelectItem>
                        <SelectItem value="discount">{t({ ku: "داشکاندن", en: "Written off", ar: "خصم", zh: "折扣核销" })}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={differenceReason}
                      onChange={(e) => setDifferenceReason(e.target.value)}
                      rows={2}
                      className={cn("text-sm", needsReason && "border-red-400 dark:border-red-700")}
                      placeholder={t({ ku: "هۆکار — داواکراوە", en: "Reason — required", ar: "السبب — مطلوب", zh: "原因——必填" })}
                      data-testid="settle-difference-reason"
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSettle || settle.isPending}
            data-testid="settle-open-confirm"
          >
            {settle.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t({ ku: "پێداچوونەوە و واصڵکردن", en: "Review and take payment", ar: "مراجعة واستلام", zh: "复核并收款" })}
            {" — "}{money(totals.dueUsd)}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t({
              ku: "نرخی دۆلار و بەروار لەگەڵ واصڵەکەدا خەزن دەکرێن",
              en: "The dollar rate and the date are stored with the receipt",
              ar: "يُحفظ سعر الدولار والتاريخ مع الإيصال",
              zh: "汇率与日期随收据一并保存",
            })}
          </span>
        </div>

        {/* ── what has already been taken on this box ──────────────── */}
        {data.settlements.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t({ ku: "واصڵەکانی پێشوو", en: "Earlier receipts", ar: "الإيصالات السابقة", zh: "此前收据" })}
            </p>
            {data.settlements.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
                   data-testid={`settlement-${s.id}`}>
                <span className="font-mono text-xs" dir="ltr">{s.settlementNumber}</span>
                <span className="font-mono tabular-nums font-semibold">{money(Number(s.paidUsd))}</span>
                {Number(s.discountUsd) > 0 && (
                  <Badge variant="secondary" className="text-amber-600 dark:text-amber-400">
                    −{money(Number(s.discountUsd))}
                  </Badge>
                )}
                {Number(s.amountIqd) > 0 && (
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {Number(s.amountIqd).toLocaleString()} IQD @ {Number(s.exchangeRate ?? 0).toLocaleString()}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString()}{s.staffName ? ` · ${s.staffName}` : ""}
                </span>
                {s.status === "reversed" ? (
                  <Badge variant="destructive" className="ms-auto">
                    {t({ ku: "هەڵوەشێنراوەتەوە", en: "Reversed", ar: "ملغى", zh: "已撤销" })}
                  </Badge>
                ) : (
                  <Button variant="ghost" size="sm" className="ms-auto h-7"
                          onClick={() => setReversing(s.id)}
                          data-testid={`settlement-reverse-${s.id}`}>
                    <RotateCcw className="me-1 h-3.5 w-3.5" />
                    {t({ ku: "ڕاستکردنەوە", en: "Correct", ar: "تصحيح", zh: "更正" })}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* ── read it all back before it is written ──────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {t({ ku: "پێداچوونەوە پێش خەزنکردن", en: "Check before saving", ar: "مراجعة قبل الحفظ", zh: "保存前复核" })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Row label={t({ ku: "پارسێل", en: "Parcels", ar: "الطرود", zh: "包裹" })}
                 value={String(totals.lines.filter((l) => !l.held).length)} />
            {totals.heldUsd > 0 && (
              <Row label={t({ ku: "تەحدید کراو", en: "Set aside", ar: "مستبعد", zh: "已搁置" })}
                   value={`${totals.lines.filter((l) => l.held).length} · ${money(totals.heldUsd)}`} tone="red" />
            )}
            {totals.discountUsd > 0 && (
              <Row label={t({ ku: "داشکاندن", en: "Discount", ar: "الخصم", zh: "折扣" })}
                   value={money(totals.discountUsd)} tone="amber" />
            )}
            <Row label={t({ ku: "پێویستە بدرێت", en: "Due", ar: "المطلوب", zh: "应付" })} value={money(totals.dueUsd)} />
            <Row label={t({ ku: "وەرگیراو", en: "Received", ar: "المستلم", zh: "已收" })} value={money(effectivePaid)} />
            {difference.kind !== "none" && (
              <Row
                label={difference.kind === "credit"
                  ? t({ ku: "کریدیت", en: "Credit", ar: "رصيد", zh: "余额" })
                  : difference.kind === "debt"
                    ? t({ ku: "قەرز", en: "Debt", ar: "دين", zh: "欠款" })
                    : t({ ku: "داشکێنراو", en: "Written off", ar: "مخصوم", zh: "核销" })}
                value={money(difference.amountUsd)}
                tone={difference.kind === "credit" ? "blue" : difference.kind === "debt" ? "red" : "amber"}
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </Button>
            <Button onClick={submit} disabled={settle.isPending} data-testid="settle-confirm">
              {settle.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t({ ku: "واصڵکردن", en: "Take payment", ar: "استلام", zh: "收款" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── correcting one that is already saved ───────────────────── */}
      <Dialog open={reversing !== null} onOpenChange={(o) => !o && setReversing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {t({ ku: "هەڵوەشاندنەوەی واصڵ", en: "Reverse this receipt", ar: "إلغاء الإيصال", zh: "撤销此收据" })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t({
              ku: "واصڵەکە ناسڕدرێتەوە — دەمێنێتەوە و نیشانەی هەڵوەشێنراوەی لێدەدرێت، چونکە وەسڵەکەی لە دەستی کڕیاردایە. پارەکەش دەگەڕێتەوە سەر حیسابەکەی.",
              en: "The receipt is not deleted — it stays, marked reversed, because the printed copy is in the customer's hands. The money goes back onto their account.",
              ar: "لا يُحذف الإيصال — يبقى ويُعلَّم كملغى، لأن النسخة المطبوعة بيد العميل. ويعود المبلغ إلى حسابه.",
              zh: "收据不会被删除——它会保留并标记为已撤销，因为打印件在客户手中。款项将退回其账户。",
            })}
          </p>
          <Textarea
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
            rows={3}
            placeholder={t({ ku: "هۆکار — داواکراوە", en: "Reason — required", ar: "السبب — مطلوب", zh: "原因——必填" })}
            data-testid="reverse-reason"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setReversing(null)}>
              {t({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </Button>
            <Button
              variant="destructive"
              disabled={reversalReason.trim().length < 3 || reverse.isPending}
              onClick={() => reverse.mutate({ settlementId: reversing!, reason: reversalReason.trim() })}
              data-testid="reverse-confirm"
            >
              {reverse.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t({ ku: "هەڵوەشاندنەوە", en: "Reverse", ar: "إلغاء", zh: "撤销" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "amber" | "red" | "blue" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "font-mono tabular-nums",
        tone === "amber" && "text-amber-600 dark:text-amber-400",
        tone === "red" && "text-red-600 dark:text-red-400",
        tone === "blue" && "text-blue-600 dark:text-blue-400",
      )}>{value}</span>
    </div>
  );
}
