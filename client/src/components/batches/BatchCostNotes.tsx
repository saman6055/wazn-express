import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { useTranslation } from "@/contexts/LanguageContext";

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
