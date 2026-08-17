import { Boxes, AlertTriangle } from "lucide-react";
import { pickLang } from "@/lib/lang";
import type { BoxInvoice } from "@shared/boxInvoice";

/**
 * One delivery box, itemised — deliberately the same document as a batch
 * invoice, because it answers the same question about the other half of what a
 * customer is billed for.
 *
 * The one structural difference is the delivery charge. It is for the box, not
 * for any parcel inside it, so it sits on its own line at the bottom rather
 * than being shared out. Splitting it would put a per-parcel delivery figure
 * on the page that the customer was never quoted and could not check.
 *
 * What the courier charged us is not here and was never fetched.
 */

interface Props {
  invoice: BoxInvoice;
  boxCode: string;
  destination?: string | null;
  deliveredAt?: Date | string | null;
  language: string;
  onPrint?: () => void;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function BoxInvoiceView({ invoice, boxCode, destination, deliveredAt, language, onPrint }: Props) {
  const { lines, totals, unpriced } = invoice;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              {pickLang(language, { ku: "حیسابی سندوق", en: "Box account", ar: "حساب الصندوق", zh: "箱子账目" })}
              <span className="font-mono">{boxCode}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {lines.length} {pickLang(language, { ku: "بەرید", en: "parcels", ar: "طرود", zh: "件" })}
              {totals.weightKg > 0 ? ` · ${totals.weightKg} kg` : ""}
              {destination ? ` · ${destination}` : ""}
              {deliveredAt ? ` · ${new Date(deliveredAt).toLocaleDateString()}` : ""}
            </p>
          </div>
          {onPrint && (
            <button onClick={onPrint} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              PDF
            </button>
          )}
        </div>
      </div>

      {unpriced > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {pickLang(language, {
              ku: "بەرید هەیە هێشتا نرخی بۆ دانەنراوە",
              en: "Some parcels have no price recorded yet",
              ar: "بعض الطرود لم يُسجَّل لها سعر بعد",
              zh: "部分包裹尚未记录价格",
            })}
            : {unpriced}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{line.label}</p>
                {line.trackingNumber && (
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{line.trackingNumber}</p>
                )}
              </div>
              <div className="shrink-0 text-end">
                <p className="font-mono font-semibold">{money(line.cost)}</p>
                {line.weightKg > 0 && (
                  <p className="font-mono text-xs text-muted-foreground">{line.weightKg} kg</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-emerald-300 bg-card p-4 dark:border-emerald-900/60">
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">
              {pickLang(language, { ku: "کۆی بەریدەکان", en: "Parcels", ar: "الطرود", zh: "包裹" })}
            </dt>
            <dd className="font-mono">{money(totals.goods)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">
              {/* Its own line, because it is charged for the box rather than
                  for anything in it. */}
              {pickLang(language, { ku: "کرێی گەیاندنی سندوق", en: "Box delivery", ar: "توصيل الصندوق", zh: "箱子配送费" })}
            </dt>
            <dd className="font-mono">{money(totals.delivery)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <dt className="text-base font-semibold">
              {pickLang(language, { ku: "کۆی گشتی", en: "Total", ar: "الإجمالي", zh: "合计" })}
            </dt>
            <dd className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-200">
              {money(totals.grand)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default BoxInvoiceView;
