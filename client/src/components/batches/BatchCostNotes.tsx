import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  batchCostWorking, carrierCostBase, resolveBatchCost, IGNORED_RATE_WORDS, type BatchCostWorking,
} from "@shared/batchCost";

/**
 * Two small notes that sit wherever a batch's profit is shown (owner,
 * 2026-10-04): the carrier's billed weight against ours, and — instead of a
 * profit — what the batch is still waiting for.
 */

export interface CarrierDifference {
  ours: number;
  carrier: number;
  units: number;
  usd: number;
  unit: "kg" | "cbm";
}

/** "Ours 69.1 kg · the carrier billed 60 — 9.1 kg fewer: +$80 more profit." */
export function CarrierDifferenceLine({ difference }: { difference: CarrierDifference | null }) {
  const { language } = useTranslation();
  if (!difference) return null;
  const d = difference;
  const digits = d.unit === "cbm" ? 4 : 2;
  const less = d.units >= 0;
  const amount = Math.abs(d.units).toFixed(digits);
  const u = d.unit === "cbm" ? "CBM" : "kg";
  return (
    <p
      className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${less ? "border-emerald-500/40 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300" : "border-red-500/40 bg-red-50/60 text-red-800 dark:bg-red-950/20 dark:text-red-300"}`}
      data-testid="carrier-difference"
    >
      {less ? <TrendingUp className="h-4 w-4 shrink-0" /> : <TrendingDown className="h-4 w-4 shrink-0" />}
      <span>
        {pickLang(language, {
          ku: `ئێمە ${d.ours.toFixed(digits)} ${u} · کۆمپانیای گواستنەوە ${d.carrier.toFixed(digits)} ${u} — ئەوان ${amount} ${u} ${less ? "کەمتریان" : "زیاتریان"} حیساب کردووە: ${less ? "+" : "−"}${fmtUsd(Math.abs(d.usd))} ${less ? "قازانجی زیادە" : "لە قازانج کەم دەبێتەوە"}`,
          en: `Ours ${d.ours.toFixed(digits)} ${u} · carrier ${d.carrier.toFixed(digits)} ${u} — it billed ${amount} ${u} ${less ? "less" : "more"}: ${less ? "+" : "−"}${fmtUsd(Math.abs(d.usd))} ${less ? "extra profit" : "off the profit"}`,
          ar: `لدينا ${d.ours.toFixed(digits)} ${u} · الشركة ${d.carrier.toFixed(digits)} ${u} — ${less ? "أقل" : "أكثر"} بـ ${amount} ${u}: ${less ? "+" : "−"}${fmtUsd(Math.abs(d.usd))}`,
          zh: `我方 ${d.ours.toFixed(digits)} ${u} · 承运商 ${d.carrier.toFixed(digits)} ${u} — ${less ? "少" : "多"} ${amount} ${u}：${less ? "+" : "−"}${fmtUsd(Math.abs(d.usd))}`,
        })}
      </span>
    </p>
  );
}

/** In place of a profit: the batch is waiting for its cost or its price. */
export function BatchWaitingFor({ waitingFor }: { waitingFor: "cost" | "price" | null | undefined }) {
  const { language } = useTranslation();
  if (!waitingFor) return null;
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-50/70 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/20 dark:text-red-300"
      data-testid="batch-waiting-for"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {waitingFor === "cost"
          ? pickLang(language, {
              ku: "قازانج و زیان چاوەڕێی نرخی تێچووە — تێچووی هەر کیلۆ/CBM یان کۆی پسوولەی کۆمپانیای گواستنەوە بنووسە.",
              en: "Profit and loss wait for the cost — enter the cost per kg/CBM or the carrier's invoice total.",
              ar: "الربح والخسارة بانتظار التكلفة — أدخل تكلفة الكيلو/المتر أو إجمالي فاتورة الشحن.",
              zh: "利润待成本 — 请输入每公斤/立方成本或承运商发票总额。",
            })
          : pickLang(language, {
              ku: "قازانج و زیان چاوەڕێی نرخی فرۆشتنە — نرخی فرۆشتنی ئەم باچە بنووسە.",
              en: "Profit and loss wait for the selling price — enter this batch's selling price.",
              ar: "الربح والخسارة بانتظار سعر البيع — أدخل سعر بيع هذه الدفعة.",
              zh: "利润待售价 — 请输入该批次售价。",
            })}
      </span>
    </div>
  );
}

/**
 * How a batch's cost was worked out — and so the real cost of a kilo.
 *
 * The owner, 2026-10-05: «کۆی ئەو بڕە پارەی داومانە بە شەریکەی نەقل … ئەبێ ئەوە
 * ڕاستی بێت، و سیستەم تێچووی ڕاستەقینەی هەر کیلۆیەک نیشان بدات». The carrier's
 * invoice over what it billed, drawn as the sum it is; and when a rate was
 * typed beside the invoice, that rate named and struck through, so the two
 * figures on a batch never disagree in silence.
 *
 * The arithmetic sits in its own left-to-right span: inside a Kurdish line
 * the numbers would change places around the ÷ and the =.
 */
export function BatchCostWorkingLine({
  working,
  className,
}: {
  working: BatchCostWorking | null | undefined;
  className?: string;
}) {
  const { language } = useTranslation();
  if (!working) return null;
  return (
    <p
      // Its own direction, said outright: the batch dialog's tabs are a
      // left-to-right island (Radix sets it), and inherited from there this
      // line started from the wrong edge with its words in the wrong order.
      dir={language === "en" || language === "zh" ? "ltr" : "rtl"}
      className={cn("flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground", className)}
      data-testid="batch-cost-working"
    >
      <span>{pickLang(language, working.label)}{working.math ? ":" : ""}</span>
      {working.math && (
        <bdi dir="ltr" className="font-mono tabular-nums text-foreground">{working.math}</bdi>
      )}
      {working.ignored && (
        <span className="basis-full text-amber-700 dark:text-amber-300" data-testid="batch-cost-ignored-rate">
          {pickLang(language, IGNORED_RATE_WORDS)}{" "}
          <bdi dir="ltr" className="font-mono tabular-nums line-through">{working.ignored}</bdi>
        </span>
      )}
    </p>
  );
}

/**
 * While the carrier's total is being typed: what it comes to per kilo.
 *
 * The same rule and the same line as after the save, worked from what is in
 * the boxes now — the total typed, the carrier's billed weight typed beside
 * it, and our own weight when the carrier's is blank. Nothing is shown until
 * there is a total: a per-unit rate on its own needs no explaining.
 */
export function BatchRealCostPreview({
  shippingType,
  total,
  typedRate,
  carrierBilled,
  ours,
}: {
  shippingType: string | null | undefined;
  total: string | number | null | undefined;
  typedRate: string | number | null | undefined;
  carrierBilled: string | number | null | undefined;
  ours: { billedKg: number; cbm: number } | null;
}) {
  const sea = shippingType === "sea";
  const base = carrierCostBase(
    shippingType,
    sea ? { chargedCbm: carrierBilled } : { chargedWeightKg: carrierBilled },
    ours ?? { billedKg: 0, cbm: 0 },
  );
  const cost = resolveBatchCost({
    shippingType,
    costPerKg: sea ? null : typedRate,
    costPerCbm: sea ? typedRate : null,
    shippingCost: total,
    chargeableKg: base,
    totalCbm: base,
  });
  if (cost.source !== "total") return null;
  return (
    <BatchCostWorkingLine
      working={batchCostWorking(cost, base)}
      className="rounded-md border border-emerald-500/40 bg-emerald-50/60 px-3 py-2 dark:bg-emerald-950/20"
    />
  );
}
