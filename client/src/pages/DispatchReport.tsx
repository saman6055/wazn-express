import { useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowRight, Loader2, MessageCircle, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { dataUrlToBytes } from "@/lib/imagePdf";
import { waznChatUrl } from "@/lib/waznChat";
import { dispatchPlainText } from "@shared/dispatchMessage";
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
  const reportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The report as a picture, for WeChat and WhatsApp (owner, 2026-10-26): on
   * a phone the share sheet opens with it attached - WeChat, the group, Send.
   * WhatsApp goes straight to Wazn's chat. The button bar is left out.
   */
  const message = () => s ? dispatchPlainText({
    batchCode: s.batch.batchCode,
    cartons: s.cartons.length,
    parcels: s.packedParcels,
    leftOut: s.unpacked.length,
    note: s.batch.dispatchNote,
    by: s.batch.dispatchCheckedBy ?? null,
    reportUrl: `${window.location.origin}/dispatch-check/${batchId}/report`,
  }) : "";
  const picture = async (): Promise<File | null> => {
    if (!reportRef.current || !s) return null;
    const { toJpeg } = await import("html-to-image");
    const url = await toJpeg(reportRef.current, {
      quality: 0.92,
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      filter: (node) => !(node instanceof HTMLElement && node.dataset.noShot === "1"),
    });
    return new File([dataUrlToBytes(url).slice().buffer as ArrayBuffer], `${s.batch.batchCode}-dispatch.jpg`, { type: "image/jpeg" });
  };
  /** The picture as PNG on the clipboard - the only kind it takes. */
  const copyPicture = async (file: File): Promise<boolean> => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) return false;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      return true;
    } catch {
      return false;
    }
  };
  const send = async (to: "sheet" | "whatsapp") => {
    setBusy(true);
    try {
      const file = await picture();
      const text = message();
      const touch = window.matchMedia?.("(pointer: coarse)").matches;
      if (file && (to === "sheet" || touch) && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      // A computer: the picture on the clipboard (Ctrl+V in the chat), or saved.
      const copied = file ? await copyPicture(file) : false;
      if (!copied && file) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
      }
      if (to === "whatsapp") window.open(waznChatUrl(text), "_blank", "noopener");
      toast.success(copied
        ? L({ ku: "وێنەکە کۆپی کرا — لە چاتەکەدا Ctrl+V بکە", en: "Picture copied — Ctrl+V in the chat", ar: "نُسخت الصورة — Ctrl+V في المحادثة", zh: "图片已复制 — 在聊天中 Ctrl+V" })
        : L({ ku: "وێنەکە پاشەکەوت کرا — بیخە ناو چاتەکە", en: "Picture saved — drop it into the chat", ar: "حُفظت الصورة — أضفها إلى المحادثة", zh: "图片已保存 — 拖入聊天" }));
    } catch {
      toast.error(L({ ku: "وێنەی ڕاپۆرت دروست نەبوو — «چاپ / PDF» بەکاربهێنە", en: "Could not draw the report — use Print / PDF", ar: "تعذر رسم التقرير — استخدم الطباعة", zh: "无法生成图片 — 请用打印/PDF" }));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !s) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div ref={reportRef} className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0" data-testid="dispatch-report">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden" data-no-shot="1">
        <Link href="/dispatch-check" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-blue-300">
          <ArrowRight className="h-4 w-4" />
          {L({ ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" })}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void send("sheet")} data-testid="dispatch-report-share">
            <Share2 className="me-2 h-4 w-4" />
            {L({ ku: "ناردن (WeChat …)", en: "Share (WeChat …)", ar: "مشاركة (WeChat …)", zh: "分享（微信…）" })}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void send("whatsapp")} className="border-emerald-400 text-emerald-700 dark:text-emerald-300" data-testid="dispatch-report-whatsapp">
            <MessageCircle className="me-2 h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" onClick={() => window.print()} data-testid="dispatch-report-print">
            <Printer className="me-2 h-4 w-4" />
            {L({ ku: "چاپ / PDF", en: "Print / PDF", ar: "طباعة / PDF", zh: "打印 / PDF" })}
          </Button>
        </div>
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
