import { useParams, Link } from "wouter";
import { ArrowRight, Loader2, Printer } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { pickLang } from "@/lib/lang";
import { fmtDate, fmtTime } from "@/lib/numericDate";

/**
 * The batch's cartons on paper (owner, 2026-10-24): what left China, carton
 * by carton, sent to Erbil ahead of the goods. Printed - or saved as a PDF -
 * from the browser; the bell links here.
 */
export default function DispatchReport() {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const params = useParams<{ id: string }>();
  // «latest»: the batch checked last - where the bell's notice opens.
  const latest = trpc.dispatch.latest.useQuery(undefined, { enabled: params.id === "latest" });
  const batchId = params.id === "latest" ? (latest.data?.batchId ?? 0) : Number(params.id) || 0;
  const { data: s, isLoading } = trpc.dispatch.state.useQuery({ batchId }, { enabled: batchId > 0 });

  if (isLoading || !s) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0" data-testid="dispatch-report">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link href="/dispatch-check" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-blue-300">
          <ArrowRight className="h-4 w-4" />
          {L({ ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" })}
        </Link>
        <Button onClick={() => window.print()} data-testid="dispatch-report-print">
          <Printer className="me-2 h-4 w-4" />
          {L({ ku: "چاپ / PDF", en: "Print / PDF", ar: "طباعة / PDF", zh: "打印 / PDF" })}
        </Button>
      </div>

      <header className="border-b-2 border-black pb-2">
        <h1 className="text-xl font-bold">
          {L({ ku: "ڕاپۆرتی پشکنینی ناردن", en: "Dispatch check report", ar: "تقرير فحص الإرسال", zh: "发货核对报告" })} — <bdi dir="ltr" className="font-mono">{s.batch.batchCode}</bdi>
        </h1>
        <p className="text-sm">
          {s.batch.dispatchCheckedAt
            ? <>{fmtDate(new Date(s.batch.dispatchCheckedAt))} {fmtTime(new Date(s.batch.dispatchCheckedAt))}{s.batch.dispatchCheckedBy ? ` · ${s.batch.dispatchCheckedBy}` : ""}</>
            : L({ ku: "هێشتا تەواو نەکراوە", en: "Not finished yet", ar: "لم يكتمل بعد", zh: "尚未完成" })}
          {" · "}
          {L({ ku: `${s.cartons.length} کارتۆن، ${s.packedParcels} پاکێج`, en: `${s.cartons.length} cartons, ${s.packedParcels} parcels`, ar: `${s.cartons.length} كرتون، ${s.packedParcels} طرد`, zh: `${s.cartons.length} 箱，${s.packedParcels} 件` })}
        </p>
      </header>

      {s.unpacked.length > 0 && (
        <section className="mt-3 border-2 border-black p-2 text-sm">
          <p className="font-bold">
            {L({ ku: `${s.unpacked.length} پاکێج نەخراونەتە ناو کارتۆن`, en: `${s.unpacked.length} parcels not packed`, ar: `${s.unpacked.length} طرد غير معبأ`, zh: `${s.unpacked.length} 件未装箱` })}
            {s.batch.dispatchNote ? ` — ${s.batch.dispatchNote}` : ""}
          </p>
          <p className="font-mono" dir="ltr">{s.unpacked.map((p) => `${p.trackingNumber || p.packageCode} (${p.customerCode ?? "—"})`).join(" · ")}</p>
        </section>
      )}

      {s.cartons.map((c) => (
        <section key={c.id} className="mt-3 break-inside-avoid">
          <h2 className="border-b border-black text-sm font-bold">
            {L({ ku: `کارتۆنی ${c.cartonNo}`, en: `Carton ${c.cartonNo}`, ar: `كرتون ${c.cartonNo}`, zh: `第 ${c.cartonNo} 箱` })}
            {" · "}{c.items.length} {L({ ku: "پاکێج", en: "parcels", ar: "طرد", zh: "件" })}
            {c.weightKg ? <> · <bdi dir="ltr">{Number(c.weightKg)} kg</bdi></> : null}
          </h2>
          <table className="w-full text-xs">
            <tbody>
              {c.items.map((i, k) => (
                <tr key={i.id} className="border-b border-gray-300 dark:border-gray-600">
                  <td className="w-6 py-0.5 tabular-nums">{k + 1}</td>
                  <td className="py-0.5 font-mono" dir="ltr">{i.trackingNumber}</td>
                  <td className="py-0.5 font-mono">{i.customerCode}</td>
                  <td className="py-0.5">{i.customerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
