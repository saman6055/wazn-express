import { Link } from "wouter";
import { Scale } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

const kg = (n: number | null) => (n === null ? "—" : `${Number(n.toFixed(2))} kg`);
const usd = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);

/**
 * One air batch against its carrier on volume (owner, 2026-10-23): what the
 * customers paid for kilos beyond the scale, what the carrier charged us for
 * its own, and what is left. The office's figures only
 * (server/db/volumetricReport.db.ts).
 */
export function BatchVolumetricCard({ batchId, language }: { batchId: number; language: string }) {
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const { data } = trpc.reports.volumetric.useQuery({ batchId }, { retry: false });
  const b = data?.byBatch[0];
  if (!b || b.figures.volumetricParcels === 0) return null;
  const rows: Array<{ label: string; ours: string; carrier: string }> = [
    { label: L({ ku: "کێشی ڕاستەقینە", en: "Scale", ar: "الفعلي", zh: "实际" }), ours: kg(b.figures.actualKg), carrier: kg(b.carrier.actualKg) },
    { label: L({ ku: "کێشی حیسابکراو", en: "Charged", ar: "المحتسب", zh: "计费" }), ours: kg(b.figures.chargedKg), carrier: kg(b.carrier.chargedKg) },
    { label: L({ ku: "زیادەی قەبارە", en: "Volume extra", ar: "زيادة الحجم", zh: "体积超出" }), ours: `+${kg(b.figures.chargedKg - b.figures.actualKg)}`, carrier: b.carrier.extraKg === null ? "—" : `+${kg(b.carrier.extraKg)}` },
    { label: L({ ku: "بە دۆلار", en: "In dollars", ar: "بالدولار", zh: "美元" }), ours: usd(b.figures.paidForVolumeUsd), carrier: usd(b.carrier.extraCostUsd) },
  ];
  return (
    <Card className="border-amber-300 dark:border-amber-800/60" data-testid="batch-volumetric-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-5 w-5 text-amber-600" />
          {L({ ku: "بارە قەبارەییەکان", en: "Volumetric parcels", ar: "الطرود الحجمية", zh: "体积重包裹" })}
          <span className="text-xs font-normal text-muted-foreground">({b.figures.volumetricParcels})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-1 text-start font-medium" />
                <th className="py-1 text-end font-medium">{L({ ku: "لەسەر کڕیار", en: "Our customers", ar: "على العملاء", zh: "客户" })}</th>
                <th className="py-1 text-end font-medium">{L({ ku: "کۆمپانیای گواستنەوە لەسەر من", en: "Carrier to us", ar: "الناقل علينا", zh: "承运商对我方" })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t">
                  <td className="py-1.5">{r.label}</td>
                  <td className="py-1.5 text-end tabular-nums" dir="ltr">{r.ours}</td>
                  <td className="py-1.5 text-end tabular-nums" dir="ltr">{r.carrier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {b.figures.discountUsd > 0 && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            {L({ ku: "داشکانی قەبارە", en: "Volume discount", ar: "خصم الحجم", zh: "体积优惠" })}: <bdi dir="ltr" className="font-semibold">{kg(b.figures.discountKg)} · {usd(b.figures.discountUsd)}</bdi>
          </p>
        )}
        <div className={cn(
          "flex items-center justify-between rounded-lg px-3 py-2 font-bold",
          b.carrier.leftForUsUsd === null ? "bg-muted" : b.carrier.leftForUsUsd >= 0 ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200",
        )}>
          <span>{L({ ku: "قازانجی قەبارە بۆ من", en: "Left for us from volume", ar: "ربحنا من الحجم", zh: "体积利润" })}</span>
          <bdi dir="ltr" className="tabular-nums">
            {b.carrier.leftForUsUsd === null
              ? L({ ku: "کێشی کۆمپانیا لە باچدا بنووسە", en: "Enter the carrier's weight on the batch", ar: "أدخل وزن الناقل في الدفعة", zh: "请在批次中填写承运商重量" })
              : usd(b.carrier.leftForUsUsd)}
          </bdi>
        </div>
        <Link href="/reports/volumetric" className="text-xs text-primary hover:underline">
          {L({ ku: "هەموو بارە قەبارەییەکان ←", en: "All volumetric parcels →", ar: "كل الطرود الحجمية ←", zh: "全部体积重包裹 →" })}
        </Link>
      </CardContent>
    </Card>
  );
}
