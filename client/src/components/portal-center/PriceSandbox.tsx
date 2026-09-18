import { useState } from "react";
import { Plane, Ship, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quoteShipping, type QuoteShippingType } from "@shared/portalQuote";
import { DEFAULT_VOLUMETRIC_DIVISOR } from "@shared/chargeableWeight";

/**
 * Try a carton before saving (owner, 2026-09-18, Portal Center phase 5): the
 * divisor and the prices being typed, against a carton's sizes and weight,
 * worked the way the customer's calculator and the invoice work it. Nothing
 * is saved from here; it opens with an example carton so it shows a result.
 */

type Words = { ku: string; en: string; ar: string; zh: string };

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number, d = 2) => Number(n.toFixed(d)).toLocaleString("en-US", { maximumFractionDigits: d });

export function PriceSandbox({
  divisor,
  prices,
}: {
  /** The divisor as typed, saved or not. */
  divisor: number;
  /** The portal's prices as typed, saved or not. */
  prices: { air_regular: string; air_irregular: string; sea: string };
}) {
  const { language } = useLanguage();
  const L = (w: Words) => pickLang(language, w);
  const [type, setType] = useState<QuoteShippingType>("air_regular");
  const [carton, setCarton] = useState({ l: "60", w: "40", h: "40", kg: "12", cbm: "" });
  const price = parseFloat(prices[type]) || 0;
  // An empty or zero divisor falls back to the one the charges fall back to.
  const usedDivisor = divisor > 0 ? divisor : DEFAULT_VOLUMETRIC_DIVISOR;
  const q = quoteShipping(
    { shippingType: type, pricePerUnit: price, weightKg: carton.kg, lengthCm: carton.l, widthCm: carton.w, heightCm: carton.h, cbm: carton.cbm },
    usedDivisor,
  );

  const types: { key: QuoteShippingType; icon: typeof Plane; label: Words }[] = [
    { key: "air_regular", icon: Plane, label: { ku: "ئاسمانی ئاسایی", en: "Air (regular)", ar: "جوي عادي", zh: "空运（常规）" } },
    { key: "air_irregular", icon: Zap, label: { ku: "ئاسمانی نائاسایی", en: "Air (irregular)", ar: "جوي غير عادي", zh: "空运（非常规）" } },
    { key: "sea", icon: Ship, label: { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" } },
  ];
  const field = (key: keyof typeof carton, label: string, unit: string) => (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={carton[key]}
          onChange={(e) => setCarton({ ...carton, [key]: e.target.value })}
          className="pe-9 font-mono"
          dir="ltr"
          data-sandbox-field={key}
        />
        <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-dashed p-3 space-y-3" data-price-sandbox>
      <div>
        <p className="text-sm font-semibold">{L({ ku: "تاقیکردنەوەی حیساب", en: "Try a carton", ar: "جرّب كرتوناً", zh: "试算一个纸箱" })}</p>
        <p className="text-[11px] text-muted-foreground">
          {L({
            ku: "دابەشکەر و نرخەکانی سەرەوە — پاشەکەوتکراو بن یان نا — لەسەر کارتۆنێک تاقی بکەرەوە. ئەنجامەکە هەمان ئەوەیە کە حیسابکەری پۆرتال و پسوولە دەیڵێن.",
            en: "Try the divisor and prices above — saved or not — on a carton. The result is what the portal's calculator and the invoice say.",
            ar: "جرّب القاسم والأسعار أعلاه — محفوظة أم لا — على كرتون. النتيجة هي ما تقوله حاسبة البوابة والفاتورة.",
            zh: "用上面的除数和价格（无论是否已保存）试算一个纸箱。结果与门户计算器和账单一致。",
          })}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold",
              type === t.key
                ? "border-purple-400 bg-purple-50 text-purple-800 dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-200"
                : "text-muted-foreground hover:bg-muted",
            )}
            aria-pressed={type === t.key}
          >
            <t.icon className="h-3.5 w-3.5" />
            {L(t.label)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {field("l", L({ ku: "درێژی", en: "Length", ar: "الطول", zh: "长" }), "cm")}
        {field("w", L({ ku: "پانی", en: "Width", ar: "العرض", zh: "宽" }), "cm")}
        {field("h", L({ ku: "بەرزی", en: "Height", ar: "الارتفاع", zh: "高" }), "cm")}
        {type === "sea"
          ? field("cbm", L({ ku: "یان قەبارە ڕاستەوخۆ", en: "Or the volume", ar: "أو الحجم مباشرة", zh: "或直接填体积" }), "m³")
          : field("kg", L({ ku: "کێشی تەرازوو", en: "Scale weight", ar: "وزن الميزان", zh: "实重" }), "kg")}
      </div>

      <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1" dir="ltr" data-sandbox-result>
        {q.unit === "kg" ? (
          <>
            <div className="font-mono">
              {num(Number(carton.l) || 0, 1)} × {num(Number(carton.w) || 0, 1)} × {num(Number(carton.h) || 0, 1)} ÷ {num(usedDivisor, 0)} = {num(q.volumetricKg)} kg
            </div>
            <div className="font-mono">
              max({num(q.actualKg)} kg, {num(q.volumetricKg)} kg) = <b>{num(q.chargeableKg)} kg</b>
            </div>
            <div className="font-mono">
              {num(q.chargeableKg)} kg × {money(price)} = <b className="text-emerald-700 dark:text-emerald-300">{money(q.total)}</b>
            </div>
          </>
        ) : (
          <>
            <div className="font-mono">
              {carton.cbm && Number(carton.cbm) > 0
                ? `${num(q.cbm, 3)} m³`
                : `${num(Number(carton.l) || 0, 1)} × ${num(Number(carton.w) || 0, 1)} × ${num(Number(carton.h) || 0, 1)} ÷ 1,000,000 = ${num(q.cbm, 3)} m³`}
            </div>
            <div className="font-mono">
              {num(q.cbm, 3)} m³ × {money(price)} = <b className="text-emerald-700 dark:text-emerald-300">{money(q.total)}</b>
            </div>
          </>
        )}
      </div>
      {q.unit === "kg" && q.chargeableKg > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {q.billedOnVolume
            ? L({ ku: "لەسەر قەبارە حساب دەکرێت — قەبارەکەی لە کێشی تەرازوو زیاترە.", en: "Billed on its size — the size weighs more than the scale says.", ar: "يُحتسب على الحجم — الوزن الحجمي أكبر من وزن الميزان.", zh: "按体积计费——体积重大于实重。" })
            : L({ ku: "لەسەر کێشی تەرازوو حساب دەکرێت.", en: "Billed on the scale weight.", ar: "يُحتسب على وزن الميزان.", zh: "按实重计费。" })}
        </p>
      )}
    </div>
  );
}
