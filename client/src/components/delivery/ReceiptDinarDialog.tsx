import { useEffect, useState } from "react";
import { Printer, Send, Percent } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GroupedNumberInput } from "@/components/expenses/GroupedNumberInput";
import {
  DEFAULT_DINAR_ROUND_MODE,
  DEFAULT_DINAR_ROUND_STEP,
  DINAR_ROUND_MODES,
  DINAR_ROUND_STEPS,
  formatIqd,
  formatRate,
  offeredRate,
  receiptDinar,
  type AdvanceCurrency,
  type DatedRate,
  type DinarRoundMode,
  type DinarRoundStep,
  roundDinars,
  type ReceiptDinarInput,
} from "@shared/receiptDinar";
import { DISCOUNT_REASON_LABELS, type DiscountReason } from "@shared/boxSettlement";
import { pledgeFloors, type DiscountPledge } from "@shared/pledgedDiscount";

type Words = { ku: string; en: string; ar: string; zh: string };

/** One parcel the discount may be given on, for the list. */
export interface ReceiptDiscountParcel {
  lineId: number;
  trackingNumber?: string | null;
  packageCode?: string | null;
  chargedUsd: number;
}

/**
 * A discount the person printing is giving, before the paper comes out.
 *
 * The owner, 2026-09-24: it may be on the whole total or on one tracking —
 * "the customer said one parcel was broken, so I had to give twenty dollars
 * on it" — and the reason goes on the receipt with it.
 */
export interface ReceiptDiscount {
  /** The box item it is given on; null is the box as a whole. */
  lineId: number | null;
  usd: number;
  reason: DiscountReason;
  trackingNumber: string | null;
}

/** What the window needs to know about the receipt about to be printed. */
export interface ReceiptDinarRequest {
  boxCode: string;
  customerName?: string | null;
  customerCode?: string | null;
  parcelCount: number;
  /**
   * The dollar figure the receipt asks for BEFORE anything given here:
   * receiptAmountUsd(box, settlement).
   */
  totalUsd: number;
  /**
   * The parcels a discount can be pointed at. Empty or absent leaves only
   * the box as a whole.
   */
  parcels?: ReceiptDiscountParcel[];
  /**
   * Discounts already promised on an earlier printing of this receipt. The
   * field opens at them and will not go below: a printed discount is a
   * promise (owner, 2026-09-24).
   */
  pledges?: DiscountPledge[];
  /**
   * False when there is nothing left to settle on this box. A discount then
   * has no money to come off, so the field is not offered at all.
   */
  canDiscount?: boolean;
  /**
   * What the button at the bottom does, so it says so: this window is the
   * same one for printing and for sending to the customer (owner,
   * 2026-09-21: "in the send flow, 'Send' is better than 'Print'").
   */
  action?: "print" | "send";
  /**
   * The rate to start from, when this receipt already has one — the rate the
   * payment used. The owner, 2026-09-22: a box that was paid for must still
   * be able to be priced in dinars again when the receipt is corrected and
   * sent, instead of the window being skipped and the dinars lost.
   */
  rate?: number | null;
  /**
   * Prints, or saves the PDF, with what was chosen — null for no dinars, and
   * null for no discount. The discount is written down before the paper is
   * printed, so the payment screen cannot disagree with what the customer
   * was handed.
   */
  onConfirm: (dinar: ReceiptDinarInput | null, discount: ReceiptDiscount | null) => void;
}

/**
 * The window before a box receipt is printed (owner, 2026-09-17).
 *
 * The counter used to convert the total to dinars by hand, take off any
 * advance the customer had handed over, and write the result on the receipt
 * with a pen. Here the person printing gives the day's rate and the advance,
 * sees the figures, and prints.
 *
 * Print-only by the owner's rule: nothing chosen here is saved to the box or
 * the customer's account. The rate and the rounding are remembered on this
 * device for next time; the advance never is, and the currency always starts
 * at dinars — most advances handed over at the counter are dinars.
 */

const MEMORY_KEY = "wazn-receipt-dinar";

interface Remembered {
  rate?: number;
  at?: number;
  step?: number;
  mode?: string;
}

function recall(): Remembered {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? (JSON.parse(raw) as Remembered) : {};
  } catch {
    return {};
  }
}

function rememberChoice(value: Remembered): void {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(value));
  } catch {
    /* private mode or blocked storage — the next print simply asks again */
  }
}

const isStep = (value: unknown): value is DinarRoundStep =>
  (DINAR_ROUND_STEPS as readonly unknown[]).includes(value);

const isMode = (value: unknown): value is DinarRoundMode =>
  (DINAR_ROUND_MODES as readonly unknown[]).includes(value);

/**
 * One value for the list: the step, with "-down" when the remainder is
 * dropped rather than rounded to the nearer thousand.
 */
const ROUNDING_DOWN = "-down";
const roundingValue = (step: DinarRoundStep, mode: DinarRoundMode) => `${step}${mode === "down" ? ROUNDING_DOWN : ""}`;

const TXT = {
  title: { ku: "پێش چاپی وەسڵ", en: "Before printing the receipt", ar: "قبل طباعة الإيصال", zh: "打印收据前" },
  sendTitle: { ku: "پێش ناردنی وەسڵ", en: "Before sending the receipt", ar: "قبل إرسال الإيصال", zh: "发送收据前" },
  send: { ku: "ناردن", en: "Send", ar: "إرسال", zh: "发送" },
  parcels: (n: number): Words => ({ ku: `${n} پاکەت`, en: `${n} parcel(s)`, ar: `${n} طرد`, zh: `${n} 件包裹` }),
  totalUsd: { ku: "کۆی گشتی بە دۆلار", en: "Total in dollars", ar: "المجموع بالدولار", zh: "美元合计" },
  rate: { ku: "نرخی دۆلاری ئەمڕۆ", en: "Today's dollar rate", ar: "سعر الدولار اليوم", zh: "今日美元汇率" },
  perDollar: { ku: "دینار بۆ هەر دۆلارێک", en: "dinars per dollar", ar: "دينار لكل دولار", zh: "第纳尔/美元" },
  rateOffered: {
    ku: "دوایین نرخی بەکارهاتوو — دەتوانیت بیگۆڕیت",
    en: "The last rate used — you can change it",
    ar: "آخر سعر مستخدم — يمكنك تغييره",
    zh: "上次使用的汇率 — 可以修改",
  },
  noRate: {
    ku: "بەبێ نرخی دۆلار، وەسڵەکە بەبێ دینار چاپ دەکرێت",
    en: "Without a rate, the receipt prints without dinars",
    ar: "بدون سعر، يُطبع الإيصال بدون دينار",
    zh: "没有汇率时，收据不显示第纳尔",
  },
  advance: { ku: "پێشەکی وەرگیراو بە دەست", en: "Advance received by hand", ar: "دفعة مقدمة مستلمة يدوياً", zh: "现场收取的预付款" },
  dinar: { ku: "دینار", en: "IQD", ar: "دينار", zh: "第纳尔" },
  advanceHint: {
    ku: "ئەگەر نییە بەتاڵی جێبهێڵە. تەنها لەسەر ئەم وەسڵە — نرخی بۆکس و حسابات ناگۆڕێت.",
    en: "Leave empty if there is none. This receipt only — the box price and the accounts do not change.",
    ar: "اتركه فارغاً إن لم يوجد. لهذا الإيصال فقط — لا يتغير سعر الصندوق ولا الحسابات.",
    zh: "没有就留空。仅用于本收据 — 不改变箱子价格和账目。",
  },
  rounding: { ku: "خڕکردنەوەی دینار", en: "Round the dinars", ar: "تقريب الدينار", zh: "第纳尔取整" },
  // Owner, 2026-09-17: an electronic payment (FIB, Qi, ZainCash, AsiaPay and
  // the rest) can pay any exact amount; cash cannot. One general name for all.
  exact: { ku: "وەک خۆی — پارەدانی ئەلیکترۆنی", en: "Exact — electronic payment", ar: "كما هو — دفع إلكتروني", zh: "不取整 — 电子支付" },
  roundingHint: {
    ku: "پارەی کاش: نزیکترین 250 · پارەدانی ئەلیکترۆنی (ئەپ یان کارت): وەک خۆی",
    en: "Cash: nearest 250 · Electronic payment (app or card): exact",
    ar: "نقداً: أقرب 250 · الدفع الإلكتروني (تطبيق أو بطاقة): كما هو",
    zh: "现金：最接近 250 · 电子支付（应用或卡）：不取整",
  },
  nearest250: { ku: "نزیکترین 250", en: "Nearest 250", ar: "أقرب 250", zh: "最接近 250" },
  nearest1000: { ku: "نزیکترین 1,000", en: "Nearest 1,000", ar: "أقرب 1,000", zh: "最接近 1,000" },
  // Owner, 2026-09-21: dinars with nothing left under the thousand. Never
  // upwards — the customer is not asked for more than the sum.
  noRemainder: { ku: "بەبێ کەسر (1,000)", en: "Without a remainder (1,000)", ar: "بدون كسر (1,000)", zh: "舍去零头（1,000）" },
  noRemainderHint: {
    ku: "کەسری خوار 1,000 دەکەوێتەوە: 150,250 دەبێتە 150,000",
    en: "Anything under 1,000 is dropped: 150,250 becomes 150,000",
    ar: "يُسقط ما دون 1,000: 150,250 تصبح 150,000",
    zh: "舍去 1,000 以下的零头：150,250 变为 150,000",
  },
  print: { ku: "چاپ", en: "Print", ar: "طباعة", zh: "打印" },
  cancel: { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" },

  // ── the discount (owner, 2026-09-24) ──────────────────────────────
  discount: { ku: "داشکاندن", en: "Discount", ar: "خصم", zh: "折扣" },
  discountFor: { ku: "داشکاندن بۆ کێ؟", en: "Discount on what?", ar: "الخصم على ماذا؟", zh: "折扣给谁？" },
  wholeBox: { ku: "کۆی گشتی", en: "The whole total", ar: "الإجمالي كله", zh: "全部总额" },
  reason: { ku: "هۆکاری داشکاندن", en: "Reason for the discount", ar: "سبب الخصم", zh: "折扣原因" },
  pickReason: { ku: "هۆکارەکە هەڵبژێرە", en: "Choose the reason", ar: "اختر السبب", zh: "选择原因" },
  reasonNeeded: {
    ku: "بەبێ هۆکار داشکاندن ناکرێت — هۆکارەکە لەسەر وەسڵەکە چاپ دەکرێت",
    en: "No discount without a reason — the reason is printed on the receipt",
    ar: "لا خصم بدون سبب — يُطبع السبب على الإيصال",
    zh: "没有原因不能打折 — 原因会印在收据上",
  },
  discountHint: {
    ku: "بە دۆلار دەنووسرێت و بە هەمان نرخ و خڕکردنەوەی سەرەوە دەگۆڕدرێت. لەسەر وەسڵەکە بە هۆکارەکەیەوە دەنووسرێت.",
    en: "Written in dollars and converted at the same rate and rounding above. It is printed on the receipt with its reason.",
    ar: "يُكتب بالدولار ويُحوَّل بنفس السعر والتقريب أعلاه. ويُطبع على الإيصال مع سببه.",
    zh: "以美元填写，按上方同一汇率与取整换算。收据上会连同原因一起打印。",
  },
  belowPledge: {
    ku: "لە بەڵێنی سەر وەسڵی چاپکراو کەمترە — بیگەڕێنەوە بۆ ئەم بڕە یان زیاتری بکە",
    en: "Below what a printed receipt promised — put it back to this, or higher",
    ar: "أقل مما وعد به إيصال مطبوع — أعده إلى هذا المبلغ أو أكثر",
    zh: "低于已打印收据上的承诺 — 请调回该金额或更高",
  },
  pledged: {
    ku: "لەسەر وەسڵێکی چاپکراو بەڵێن دراوە — کەمتر ناکرێتەوە، زیاتر دەکرێت",
    en: "Promised on a receipt already printed — it cannot go down, only up",
    ar: "وُعد به على إيصال مطبوع — لا يمكن تقليله، فقط زيادته",
    zh: "已在打印的收据上承诺 — 只能增加，不能减少",
  },
  afterDiscount: { ku: "کۆی گشتی دوای داشکاندن", en: "Total after the discount", ar: "الإجمالي بعد الخصم", zh: "折后总额" },
} as const;

export function ReceiptDinarDialog({ request, onClose }: { request: ReceiptDinarRequest | null; onClose: () => void }) {
  const { t, language, isRTL } = useTranslation();
  const L = (words: Words) => pickLang(language, words);
  const open = !!request;
  const sending = request?.action === "send";

  const lastPayment = trpc.deliveryBox.lastExchangeRate.useQuery(undefined, {
    enabled: open,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const [rate, setRate] = useState("");
  const [rateTouched, setRateTouched] = useState(false);
  const [advance, setAdvance] = useState("");
  const [currency, setCurrency] = useState<AdvanceCurrency>("IQD");
  const [step, setStep] = useState<DinarRoundStep>(DEFAULT_DINAR_ROUND_STEP);
  const [mode, setMode] = useState<DinarRoundMode>(DEFAULT_DINAR_ROUND_MODE);

  // The discount: what it is given on, how much, and why (owner, 2026-09-24).
  // The reason starts unchosen on purpose — it is printed on the receipt, and
  // a default would quietly put the wrong one there.
  const [target, setTarget] = useState<string>("box");
  const [discount, setDiscount] = useState("");
  const [discountReason, setDiscountReason] = useState<DiscountReason | "">("");

  // Fresh for every receipt: the advance empty, dinars selected, the
  // rounding as last chosen on this device — and the discount at whatever an
  // earlier printing of this receipt already promised.
  useEffect(() => {
    if (!request) return;
    const saved = recall();
    setAdvance("");
    setCurrency("IQD");
    setRateTouched(false);
    setStep(isStep(saved.step) ? saved.step : DEFAULT_DINAR_ROUND_STEP);
    setMode(isMode(saved.mode) ? saved.mode : DEFAULT_DINAR_ROUND_MODE);

    const open = request.pledges ?? [];
    const first = open.length > 0 ? [...open].sort((a, b) => b.usd - a.usd)[0]! : null;
    const floors = pledgeFloors(open);
    const promised = first
      ? (first.lineId === null ? floors.boxUsd : floors.byLine.get(first.lineId) ?? first.usd)
      : 0;
    setTarget(first && first.lineId !== null ? String(first.lineId) : "box");
    setDiscount(promised > 0 ? String(promised) : "");
    setDiscountReason(first?.reason ?? "");
  }, [request]);

  // The rate offered: this receipt's own if it has one, otherwise the newer
  // of the last one printed on this device and the last one a payment used —
  // until the person types their own.
  const ownRate = Number(request?.rate);
  const payment: DatedRate | null = lastPayment.data
    ? { rate: Number(lastPayment.data.rate), at: new Date(lastPayment.data.at).getTime() }
    : null;
  const saved = recall();
  const device: DatedRate | null = saved.rate && saved.at ? { rate: saved.rate, at: saved.at } : null;
  const offered = Number.isFinite(ownRate) && ownRate > 0 ? ownRate : offeredRate(device, payment);
  useEffect(() => {
    if (request && !rateTouched) setRate(offered ? String(offered) : "");
  }, [request, rateTouched, offered]);

  /**
   * The discount comes off in dollars, and what remains is converted once —
   * the rule the whole receipt is built on, so the lines on the paper add up
   * by hand.
   *
   * Its own figure in dinars is therefore the difference between the two
   * rounded totals rather than a third rounding of its own. At "without a
   * remainder" that is what the customer actually saves on the day, and it
   * can never leave the paper one thousand short.
   */
  const canDiscount = request?.canDiscount !== false;
  const grossUsd = request?.totalUsd ?? 0;
  const cutUsd = canDiscount ? Math.max(0, Math.min(grossUsd, Number(discount) || 0)) : 0;
  const netUsd = Math.round(Math.max(0, grossUsd - cutUsd) * 100) / 100;

  const input: ReceiptDinarInput | null =
    Number(rate) > 0
      ? { rate: Number(rate), step, mode, advanceAmount: Number(advance) || null, advanceCurrency: currency }
      : null;
  const figures = request ? receiptDinar(netUsd, input) : null;
  const cutIqd = input && cutUsd > 0
    ? roundDinars(grossUsd * input.rate, step, mode) - roundDinars(netUsd * input.rate, step, mode)
    : 0;

  const parcels = request?.parcels ?? [];
  const chosen = target === "box" ? null : parcels.find((p) => String(p.lineId) === target) ?? null;
  // The floor this receipt may not go under: what an earlier printing of it
  // already promised on the same target.
  const floors = pledgeFloors(request?.pledges ?? []);
  const floorUsd = chosen ? (floors.byLine.get(chosen.lineId) ?? 0) : floors.boxUsd;
  const belowPledge = floorUsd > 0 && cutUsd + 0.004 < floorUsd;
  const reasonMissing = cutUsd > 0 && !discountReason;
  const blocked = reasonMissing || belowPledge;

  const confirm = () => {
    if (!request || blocked) return;
    if (input) rememberChoice({ rate: input.rate, at: Date.now(), step, mode });
    const print = request.onConfirm;
    const given: ReceiptDiscount | null =
      cutUsd > 0 && discountReason
        ? {
            lineId: chosen ? chosen.lineId : null,
            usd: cutUsd,
            reason: discountReason,
            trackingNumber: chosen ? (chosen.trackingNumber ?? chosen.packageCode ?? null) : null,
          }
        : null;
    onClose();
    print(input, given);
  };

  const row = (label: string, value: string, strong = false) => (
    <div className={cn("flex items-center justify-between gap-3 py-1.5", strong && "font-semibold")}>
      <span className={cn("text-sm", strong && "text-base")}>{label}</span>
      <bdi dir="ltr" className={cn("font-mono", strong ? "text-lg text-emerald-600 dark:text-emerald-400" : "text-sm")}>
        {value}
      </bdi>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent dir={isRTL ? "rtl" : "ltr"} className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {sending ? <Send className="h-5 w-5 text-primary" /> : <Printer className="h-5 w-5 text-primary" />}
            {L(sending ? TXT.sendTitle : TXT.title)}
            <bdi dir="ltr" className="ms-auto rounded-md border bg-muted px-2 py-0.5 font-mono text-xs">
              {request?.boxCode}
            </bdi>
          </DialogTitle>
          <DialogDescription>
            <bdi dir="ltr">{request?.customerName || "—"}</bdi> · <bdi dir="ltr" className="font-mono">{request?.customerCode || "—"}</bdi>
            {" · "}
            {L(TXT.parcels(request?.parcelCount ?? 0))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
            <span className="text-sm">{L(TXT.totalUsd)}</span>
            <bdi dir="ltr" className="font-mono text-base font-semibold">${(request?.totalUsd ?? 0).toFixed(2)}</bdi>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt-dinar-rate">{L(TXT.rate)}</Label>
            <div className="flex items-center gap-2">
              <GroupedNumberInput
                id="receipt-dinar-rate"
                inputMode="decimal"
                dir="ltr"
                value={rate}
                onValueChange={(v) => { setRate(v); setRateTouched(true); }}
                placeholder="1465"
                className="h-10 flex-1"
                data-testid="receipt-dinar-rate"
              />
              <span className="whitespace-nowrap text-xs text-muted-foreground">{L(TXT.perDollar)}</span>
            </div>
            {!input ? (
              <p className="text-xs text-muted-foreground">{L(TXT.noRate)}</p>
            ) : !rateTouched && offered ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">✓ {L(TXT.rateOffered)}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt-dinar-advance">{L(TXT.advance)}</Label>
            <div className="flex items-stretch gap-2">
              <GroupedNumberInput
                id="receipt-dinar-advance"
                inputMode="decimal"
                dir="ltr"
                value={advance}
                onValueChange={setAdvance}
                placeholder="0"
                className="h-10 flex-1"
                data-testid="receipt-dinar-advance"
              />
              <div role="radiogroup" aria-label={L(TXT.advance)} className="flex overflow-hidden rounded-md border">
                {(["IQD", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={currency === c}
                    onClick={() => setCurrency(c)}
                    className={cn(
                      "px-3 text-sm transition-colors",
                      currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                    data-testid={`receipt-dinar-currency-${c}`}
                  >
                    {c === "IQD" ? L(TXT.dinar) : "$"}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{L(TXT.advanceHint)}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{L(TXT.rounding)}</Label>
            <Select
              value={roundingValue(step, mode)}
              onValueChange={(v) => {
                const down = v.endsWith(ROUNDING_DOWN);
                const n = Number(down ? v.slice(0, -ROUNDING_DOWN.length) : v);
                if (!isStep(n)) return;
                setStep(n);
                setMode(down ? "down" : "nearest");
              }}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{L(TXT.exact)}</SelectItem>
                <SelectItem value="250">{L(TXT.nearest250)}</SelectItem>
                <SelectItem value="1000">{L(TXT.nearest1000)}</SelectItem>
                <SelectItem value={`1000${ROUNDING_DOWN}`}>{L(TXT.noRemainder)}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{mode === "down" ? L(TXT.noRemainderHint) : L(TXT.roundingHint)}</p>
          </div>

          {/* ── the discount, and what it was given for ──────────────
              Owner, 2026-09-24: in dollars, in step with the rate above,
              on the whole total or on one tracking, with the reason — and
              the reason is printed on the paper. */}
          {canDiscount && (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <Label className="text-sm font-medium">{L(TXT.discount)}</Label>
              </div>

              {parcels.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{L(TXT.discountFor)}</span>
                  <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger className="h-9 w-full" data-testid="receipt-discount-target">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="box">{L(TXT.wholeBox)}</SelectItem>
                      {parcels.map((p) => (
                        <SelectItem key={p.lineId} value={String(p.lineId)}>
                          <bdi dir="ltr" className="font-mono text-xs">
                            {p.trackingNumber || p.packageCode || `#${p.lineId}`}
                          </bdi>
                          {" · "}
                          <bdi dir="ltr">${p.chargedUsd.toFixed(2)}</bdi>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-stretch gap-2">
                  <span className="flex items-center text-sm text-muted-foreground">$</span>
                  <GroupedNumberInput
                    inputMode="decimal"
                    dir="ltr"
                    value={discount}
                    onValueChange={setDiscount}
                    placeholder="0"
                    className="h-9 flex-1"
                    data-testid="receipt-discount-amount"
                  />
                </div>
                <Select
                  value={discountReason || undefined}
                  onValueChange={(v) => setDiscountReason(v as DiscountReason)}
                >
                  <SelectTrigger className="h-9" data-testid="receipt-discount-reason">
                    <SelectValue placeholder={L(TXT.pickReason)} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DISCOUNT_REASON_LABELS) as DiscountReason[]).map((r) => (
                      <SelectItem key={r} value={r}>{L(DISCOUNT_REASON_LABELS[r])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {cutUsd > 0 && input && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {L(TXT.dinar)}: <bdi dir="ltr" className="font-mono">{formatIqd(cutIqd)}</bdi>
                </p>
              )}
              {floorUsd > 0 && (
                <p
                  className={cn(
                    "text-xs",
                    belowPledge
                      ? "font-medium text-red-600 dark:text-red-400"
                      : "text-amber-700 dark:text-amber-400",
                  )}
                  data-testid="receipt-discount-pledged"
                >
                  {L(belowPledge ? TXT.belowPledge : TXT.pledged)} —{" "}
                  <bdi dir="ltr" className="font-mono">${floorUsd.toFixed(2)}</bdi>
                </p>
              )}
              {reasonMissing && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{L(TXT.reasonNeeded)}</p>
              )}
              {!reasonMissing && <p className="text-xs text-muted-foreground">{L(TXT.discountHint)}</p>}
            </div>
          )}

          {/* The receipt's own lines, in its order (dinarRowsHtml). */}
          {figures && (
            <div className="rounded-lg border-2 border-dashed border-emerald-500/60 px-3 py-1" data-testid="receipt-dinar-preview">
              {cutUsd > 0 && (
                <>
                  {row(L(TXT.discount), `− $${cutUsd.toFixed(2)}`)}
                  {row(L(TXT.afterDiscount), `$${netUsd.toFixed(2)}`)}
                </>
              )}
              {figures.advance?.currency === "USD" ? (
                <>
                  {row(t("delivery.advancePaid"), `− $${figures.advance.amount.toFixed(2)}`)}
                  {row(t("delivery.amountDue"), `$${(figures.dueUsd ?? 0).toFixed(2)}`)}
                  {row(t("delivery.dollarRate"), `1 $ = ${formatRate(figures.rate)} IQD`)}
                  {row(t("delivery.amountDueInIqd"), formatIqd(figures.dueIqd), true)}
                </>
              ) : figures.advance ? (
                <>
                  {row(t("delivery.dollarRate"), `1 $ = ${formatRate(figures.rate)} IQD`)}
                  {row(t("delivery.totalInIqd"), formatIqd(figures.totalIqd))}
                  {row(t("delivery.advancePaid"), `− ${formatIqd(figures.advance.amount)}`)}
                  {row(t("delivery.amountDueInIqd"), formatIqd(figures.dueIqd), true)}
                </>
              ) : (
                <>
                  {row(t("delivery.dollarRate"), `1 $ = ${formatRate(figures.rate)} IQD`)}
                  {row(t("delivery.totalInIqd"), formatIqd(figures.totalIqd), true)}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button onClick={confirm} disabled={blocked} className="flex-1" data-testid="receipt-dinar-print">
            {sending ? <Send className="me-1.5 h-4 w-4" /> : <Printer className="me-1.5 h-4 w-4" />}
            {L(sending ? TXT.send : TXT.print)}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            {L(TXT.cancel)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
