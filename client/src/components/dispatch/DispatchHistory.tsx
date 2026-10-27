import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, Loader2, MessageCircle, PackageOpen, Plane, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate, fmtTime } from "@/lib/numericDate";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DISPATCH_STAGE_WORDS, leftChinaWhatsApp, type DispatchStage } from "@shared/dispatchStage";
import { whatsappChatUrl, whatsappNumber } from "@shared/receiptWhatsApp";

/**
 * What the dispatch check has kept (owner, 2026-10-26): every batch packed in
 * China as a small card in the colour of where it stands
 * (shared/dispatchStage) - blue packing, orange left China, red in Erbil with
 * parcels still missing, green all arrived. A click opens the batch in
 * figures. Above them, "where is my parcel?" for the office in Erbil.
 */

type Words = { ku: string; en: string; ar: string; zh: string };

const STAGE_LOOK: Record<DispatchStage, { card: string; label: string; icon: typeof PackageOpen }> = {
  packing: { card: "border-sky-400 dark:border-sky-700", label: "text-sky-700 dark:text-sky-300", icon: PackageOpen },
  left: { card: "border-amber-400 dark:border-amber-700", label: "text-amber-700 dark:text-amber-300", icon: Plane },
  arriving: { card: "border-red-400 dark:border-red-700", label: "text-red-700 dark:text-red-300", icon: AlertTriangle },
  arrived: { card: "border-emerald-400 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30", label: "text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
};

export function DispatchHistory({ onOpen }: { onOpen: (batchId: number) => void }) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const { data, isLoading } = trpc.dispatch.history.useQuery();
  const [openId, setOpenId] = useState<number | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const rows = data ?? [];

  return (
    <div className="space-y-5" data-testid="dispatch-history">
      <WhereIsMyParcel />
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground" data-testid="dispatch-history-empty">
          {L({ ku: "هێشتا هیچ باچێک نەخراوەتە ناو کارتۆن. لە سەرەوە باچێک هەڵبژێرە بۆ دەستپێکردن.", en: "No batch has been packed into cartons yet. Choose a batch above to start.", ar: "لم تُعبأ أي دفعة في كراتين بعد. اختر دفعة أعلاه للبدء.", zh: "尚无批次装箱。请在上方选择批次开始。" })}
        </p>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const look = STAGE_LOOK[r.stage];
            const Icon = look.icon;
            const expanded = openId === r.batchId;
            return (
              <div key={r.batchId} className={`rounded-xl border-2 bg-card p-4 ${look.card} ${expanded ? "sm:col-span-2 lg:col-span-3" : ""}`} data-testid="dispatch-history-card" data-stage={r.stage}>
                <button type="button" className="w-full text-start" onClick={() => setOpenId(expanded ? null : r.batchId)} aria-expanded={expanded} data-testid="dispatch-card-toggle">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`flex items-center gap-1 text-xs font-medium ${look.label}`}>
                        <Icon className="h-4 w-4" />
                        {L(DISPATCH_STAGE_WORDS[r.stage])}
                      </p>
                      <p className="mt-1 font-mono text-lg font-bold" dir="ltr">{r.batchCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.finishedAt ? <>{fmtDate(new Date(r.finishedAt))} {fmtTime(new Date(r.finishedAt))}{r.finishedBy ? ` · ${r.finishedBy}` : ""}</> : null}
                      </p>
                    </div>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center tabular-nums">
                    <Tile value={r.cartons} label={L({ ku: "کارتۆن", en: "cartons", ar: "كرتون", zh: "箱" })} />
                    {r.stage === "arriving" || r.stage === "arrived"
                      ? <Tile value={<>{r.arrived}<span className="text-xs text-muted-foreground">/{r.packed}</span></>} label={L({ ku: "گەیشتوو", en: "arrived", ar: "وصل", zh: "已到" })} />
                      : <Tile value={<>{r.parcels}<span className="text-xs text-muted-foreground">/{r.totalParcels}</span></>} label={L({ ku: "پاکێج", en: "parcels", ar: "طرد", zh: "件" })} />}
                    <Tile value={r.leftOut} label={L({ ku: "بەجێماو", en: "left out", ar: "متبقٍ", zh: "未装" })} warn={r.leftOut > 0} />
                  </div>
                  {r.stage === "arriving" && r.missingCartons.length > 0 && (
                    <p className="mt-2 text-xs text-red-700 dark:text-red-300" data-testid="dispatch-missing-cartons">
                      {r.missingCartons.map((c) => L({ ku: `کارتۆنی ${c.cartonNo}: ${c.missing} لە ${c.total} کەمە`, en: `Carton ${c.cartonNo}: ${c.missing} of ${c.total} missing`, ar: `كرتون ${c.cartonNo}: ينقص ${c.missing} من ${c.total}`, zh: `第${c.cartonNo}箱：缺 ${c.missing}/${c.total}` })).join(" · ")}
                    </p>
                  )}
                  {r.waitingSecondLoad && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300" data-testid="dispatch-second-load">
                      {L({ ku: "باری دووەم چاوەڕێ دەکرێت", en: "A second load is expected", ar: "يُنتظر وصول الشحنة الثانية", zh: "等待第二批到货" })}
                    </p>
                  )}
                  {r.note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{r.note}</p>}
                </button>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant={r.finishedAt ? "outline" : "default"} onClick={() => onOpen(r.batchId)} data-testid="dispatch-history-open">
                    {r.finishedAt ? L({ ku: "کارتۆنەکان", en: "Cartons", ar: "الكراتين", zh: "箱子" }) : L({ ku: "بەردەوامبوون", en: "Continue", ar: "متابعة", zh: "继续" })}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dispatch-check/${r.batchId}/report`} data-testid="dispatch-history-report">
                      <FileText className="me-1 h-4 w-4" />
                      {L({ ku: "ڕاپۆرت", en: "Report", ar: "التقرير", zh: "报告" })}
                    </Link>
                  </Button>
                </div>
                {expanded && <DispatchDetails batchId={r.batchId} batchCode={r.batchCode} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tile({ value, label, warn }: { value: React.ReactNode; label: string; warn?: boolean }) {
  return (
    <div className={`rounded-md p-2 ${warn ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "bg-muted/50"}`}>
      <p className="text-lg font-semibold">{value}</p>
      <p className={`text-[11px] ${warn ? "" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

/** The batch in figures, opened by a click on its card. */
function DispatchDetails({ batchId, batchCode }: { batchId: number; batchCode: string }) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const { data, isLoading } = trpc.dispatch.details.useQuery({ batchId });
  if (isLoading || !data) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const t = data.totals;
  const kg = (n: number) => <bdi dir="ltr">{n.toFixed(2)} kg</bdi>;

  return (
    <div className="mt-4 space-y-4 border-t pt-4 text-sm" data-testid="dispatch-details">
      <div className="grid grid-cols-3 gap-2 text-center tabular-nums sm:grid-cols-6">
        <Tile value={t.trackings} label={L({ ku: "تراک", en: "trackings", ar: "تتبع", zh: "单号" })} />
        <Tile value={t.cartons} label={L({ ku: "کارتۆن", en: "cartons", ar: "كرتون", zh: "箱" })} />
        <Tile value={t.customers} label={L({ ku: "کڕیار", en: "customers", ar: "عميل", zh: "客户" })} />
        <Tile value={kg(t.scaleKg)} label={L({ ku: "کێشی تەرازوو", en: "scale weight", ar: "الوزن الفعلي", zh: "实重" })} />
        <Tile value={kg(t.volumeKg)} label={L({ ku: "کێشی قەبارەیی", en: "volume weight", ar: "الوزن الحجمي", zh: "体积重" })} />
        <Tile value={kg(t.chargedKg)} label={L({ ku: "کێشی حیسابکراو", en: "charged weight", ar: "الوزن المحتسب", zh: "计费重" })} />
      </div>

      {data.topVolume.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold">{L({ ku: "گەورەترین کێشی قەبارەیی", en: "Largest volume weights", ar: "أكبر الأوزان الحجمية", zh: "体积重最大的包裹" })}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums" data-testid="dispatch-top-volume">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 text-start">{L({ ku: "تراک · کڕیار", en: "Tracking · customer", ar: "التتبع · العميل", zh: "单号 · 客户" })}</th>
                  <th className="py-1 text-start">{L({ ku: "تەرازوو", en: "Scale", ar: "الفعلي", zh: "实重" })}</th>
                  <th className="py-1 text-start">{L({ ku: "قەبارە", en: "Volume", ar: "الحجمي", zh: "体积重" })}</th>
                  <th className="py-1 text-start">×</th>
                  <th className="py-1 text-start">{L({ ku: "کارتۆن", en: "Carton", ar: "كرتون", zh: "箱" })}</th>
                </tr>
              </thead>
              <tbody>
                {data.topVolume.map((v) => (
                  <tr key={v.trackingNumber} className="border-t">
                    <td className="py-1 font-mono" dir="ltr">{v.trackingNumber} · {v.customerCode ?? "—"}</td>
                    <td className="py-1">{kg(v.scaleKg)}</td>
                    <td className="py-1 font-semibold text-red-700 dark:text-red-300">{kg(v.volumeKg)}</td>
                    <td className="py-1" dir="ltr">{v.times != null ? `×${v.times}` : "—"}</td>
                    <td className="py-1">{v.cartonNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-1 font-semibold">
          {L({ ku: `بەپێی کڕیار (${data.customers.length})`, en: `By customer (${data.customers.length})`, ar: `حسب العميل (${data.customers.length})`, zh: `按客户（${data.customers.length}）` })}
          <span className="ms-2 text-xs font-normal text-muted-foreground">
            {L({ ku: "هەموویان لە پۆرتاڵ ئاگادار کرانەوە", en: "All were told on the portal", ar: "تم إبلاغ الجميع في البوابة", zh: "均已在门户通知" })}
          </span>
        </h3>
        <div className="divide-y rounded-md border">
          {data.customers.map((c) => {
            const number = whatsappNumber(c.mobile);
            return (
              <div key={`${c.customerId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs tabular-nums" data-testid="dispatch-customer-row">
                <span className="min-w-32 font-medium">
                  <bdi dir="ltr" className="font-mono">{c.customerCode ?? "—"}</bdi> · {c.customerName ?? "—"}
                </span>
                <span>{c.count} {L({ ku: "تراک", en: "trackings", ar: "تتبع", zh: "单" })}</span>
                <span>{kg(c.fullKg)}</span>
                <span>{L({ ku: "کارتۆن", en: "carton", ar: "كرتون", zh: "箱" })} {c.cartons.join("، ")}</span>
                <span className="flex-1" />
                {number && (
                  <Button size="sm" variant="ghost" className="h-7 text-emerald-700 dark:text-emerald-300" asChild>
                    <a href={whatsappChatUrl(number, leftChinaWhatsApp(c.customerName, batchCode, c.trackings))} target="_blank" rel="noopener noreferrer" data-testid="dispatch-customer-whatsapp">
                      <MessageCircle className="me-1 h-4 w-4" />
                      {L({ ku: "ناردن", en: "Send", ar: "إرسال", zh: "发送" })}
                    </a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** One parcel's place, in the words a customer on the phone needs. */
const PARCEL_WORDS: Record<"packing" | "left" | "arrived", Words> = {
  packing: { ku: "لە چین — لە کارتۆندایە", en: "In China — packed", ar: "في الصين — معبأ", zh: "在中国 — 已装箱" },
  left: { ku: "لە ڕێگایە", en: "On the way", ar: "في الطريق", zh: "运输中" },
  arrived: { ku: "گەیشتووە", en: "Arrived", ar: "وصل", zh: "已到达" },
};

/** "Where is my parcel?" - for the office in Erbil when a customer calls. */
function WhereIsMyParcel() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const [q, setQ] = useState("");
  const query = useDebouncedValue(q.trim(), 300);
  const { data, isFetching } = trpc.dispatch.find.useQuery({ query }, { enabled: query.length >= 3 });
  const rows = query.length >= 3 ? data ?? [] : [];

  return (
    <div className="rounded-xl border bg-card p-3" data-testid="dispatch-find">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" dir="auto"
          placeholder={L({ ku: "کاڵاکەم لە کوێیە؟ — تراک یان کۆدی کڕیار (AZ256)", en: "Where is my parcel? — tracking or customer code (AZ256)", ar: "أين طردي؟ — رقم التتبع أو رمز العميل (AZ256)", zh: "我的包裹在哪？— 单号或客户编码（AZ256）" })}
          data-testid="dispatch-find-input" />
      </div>
      {query.length >= 3 && (
        <div className="mt-2 text-xs">
          {isFetching && rows.length === 0 ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            : rows.length === 0 ? (
              <p className="text-muted-foreground">{L({ ku: "لە هیچ کارتۆنێکی چیندا نییە", en: "Not in any carton packed in China", ar: "ليس في أي كرتون عُبئ في الصين", zh: "不在任何中国装箱中" })}</p>
            ) : (
              <div className="divide-y rounded-md border">
                {rows.map((r) => (
                  <div key={r.packageId} className="flex flex-wrap items-center gap-x-3 px-3 py-1.5 tabular-nums" data-testid="dispatch-find-row">
                    <bdi dir="ltr" className="font-mono">{r.trackingNumber}</bdi>
                    <span>{r.customerCode ?? "—"}</span>
                    <bdi dir="ltr" className="font-mono">{r.batchCode}</bdi>
                    <span>{L({ ku: `کارتۆنی ${r.cartonNo}`, en: `carton ${r.cartonNo}`, ar: `كرتون ${r.cartonNo}`, zh: `第${r.cartonNo}箱` })}</span>
                    <span className={`font-medium ${STAGE_LOOK[r.stage].label}`}>{L(PARCEL_WORDS[r.stage])}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
