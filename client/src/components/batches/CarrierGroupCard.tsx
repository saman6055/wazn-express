import { useEffect, useState } from "react";
import { CheckCircle2, CopyPlus, FileText, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BATCH_ROLE_LABEL, BATCH_ROLE_TONE, batchRole } from "@shared/batchRole";
import { groupVerdict } from "@shared/carrierGroup";

/**
 * One carrier shipment, several of our batches (owner, 2026-10-28): the
 * China batch's Erbil twin, made from here; every batch with the same
 * carrier batch number; the carrier's one invoice, shared out by the kilos
 * our customers were charged on; and ours against theirs (shared/carrierGroup).
 *
 * Inside the batch edit form: buttons are type="button", fields have no name.
 */

type Words = { ku: string; en: string; ar: string; zh: string };
const noEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter") e.preventDefault(); };

export function CarrierGroupCard({ batchId, madeInChina, shippingType, onChanged }: { batchId: number; madeInChina: boolean; shippingType: string; onChanged: () => void }) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const utils = trpc.useUtils();
  const q = trpc.batches.carrierGroup.forBatch.useQuery({ batchId });
  const g = q.data;
  const [kg, setKg] = useState("");
  const [usd, setUsd] = useState("");
  // The day this load reached Erbil: a batch with parcels checked in before
  // it came partly on an earlier load (AIR-2026-069, owner 2026-10-29).
  const [day, setDay] = useState("");
  useEffect(() => {
    if (g?.invoice) { setKg(String(g.invoice.billedKg)); setUsd(String(g.invoice.costUsd)); setDay(g.invoice.arrivedOn ?? ""); }
  }, [g?.invoice?.billedKg, g?.invoice?.costUsd, g?.invoice?.arrivedOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (msg: string) => { toast.success(msg); void q.refetch(); void utils.batches.invalidate(); onChanged(); };
  const fail = (e: { message: string }) => toast.error(e.message);
  const twin = trpc.batches.carrierGroup.createTwin.useMutation({
    onSuccess: (r) => done(L({ ku: `باچی ${r.batchCode} دروست کرا — نرخی فرۆشتنی بۆ دابنێ`, en: `${r.batchCode} created — set its selling price`, ar: `أُنشئت ${r.batchCode} — حدّد سعر البيع`, zh: `已创建 ${r.batchCode} — 请设置售价` })),
    onError: fail,
  });
  const save = trpc.batches.carrierGroup.saveInvoice.useMutation({
    onSuccess: (r) => done(r.skipped.length
      ? L({ ku: `وەسڵ پاشەکەوت کرا · ${r.skipped.map((s) => s.batchCode).join("، ")} نەگۆڕدرا`, en: `Invoice saved · ${r.skipped.map((s) => s.batchCode).join(", ")} left as they were`, ar: "حُفظت الفاتورة", zh: "发票已保存" })
      : L({ ku: "وەسڵ پاشەکەوت کرا و پارەکە دابەش کرا", en: "Invoice saved and shared out", ar: "حُفظت الفاتورة ووُزّعت", zh: "发票已保存并分摊" })),
    onError: fail,
  });
  const reapply = trpc.batches.carrierGroup.reapply.useMutation({ onSuccess: () => done(L({ ku: "دووبارە دابەش کرا", en: "Shared out again", ar: "أُعيد التوزيع", zh: "已重新分摊" })), onError: fail });

  if (q.isLoading) return null;
  const hasTwin = !!g?.members.some((m) => m.twinOfBatchId === batchId);
  const canTwin = isAdmin && madeInChina && shippingType !== "sea" && !hasTwin;
  if (!g && !canTwin) return null;

  const kgf = (n: number) => <bdi dir="ltr" className="tabular-nums">{n.toFixed(2)} kg</bdi>;
  const billed = g?.invoice?.billedKg ?? 0;
  const max = Math.max(billed, g?.oursKg ?? 0, 1) * 1.08;
  const tone = g?.verdict === "short" ? "text-red-700 dark:text-red-300" : g?.verdict === "ahead" || g?.verdict === "even" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300";

  return (
    <div className="mt-3 space-y-3 rounded-md border p-3" data-testid="carrier-group">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="h-4 w-4 text-sky-600 dark:text-sky-300" />
          {g?.key
            ? L({ ku: `گرووپی ${g.key} · ${g.members.length} باچ`, en: `Group ${g.key} · ${g.members.length} batches`, ar: `مجموعة ${g.key} · ${g.members.length} دفعات`, zh: `组 ${g.key} · ${g.members.length} 批` })
            : L({ ku: "باچی جووت", en: "Twin batches", ar: "دفعات توأم", zh: "孪生批次" })}
        </span>
        {canTwin && (
          <Button type="button" size="sm" onClick={() => twin.mutate({ batchId })} disabled={twin.isPending} data-testid="carrier-group-twin">
            {twin.isPending ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <CopyPlus className="me-1 h-4 w-4" />}
            {L({ ku: "باچی هەولێر دروست بکە (توین)", en: "Make the Erbil twin", ar: "أنشئ دفعة أربيل التوأم", zh: "创建埃尔比勒孪生批次" })}
          </Button>
        )}
      </div>

      {g && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 text-start">{L({ ku: "باچ", en: "Batch", ar: "الدفعة", zh: "批次" })}</th>
                  <th className="py-1 text-start">{L({ ku: "کێشی سەر کڕیار", en: "Charged to customers", ar: "المحتسب على العملاء", zh: "客户计费重" })}</th>
                  <th className="py-1 text-start">{L({ ku: "گەیشتوو / تۆمارکراو", en: "In Erbil", ar: "في أربيل", zh: "已到" })}</th>
                  {g.invoice && <th className="py-1 text-start">{L({ ku: "بەشی پارە", en: "Cost share", ar: "حصة التكلفة", zh: "成本分摊" })}</th>}
                </tr>
              </thead>
              <tbody>
                {g.members.map((m) => {
                  const share = g.shares.find((s) => s.batchId === m.batchId);
                  return (
                    <tr key={m.batchId} className={cn("border-t", m.batchId === batchId && "bg-muted/40")} data-testid="carrier-group-member">
                      <td className="py-1">
                        {(() => {
                          // Which is the original and which hang on it (shared/batchRole).
                          const role = batchRole(m, g.members);
                          return <span className={cn("me-1 rounded px-1.5 py-px text-[10px] font-semibold", BATCH_ROLE_TONE[role])} data-testid="carrier-group-role" data-role={role}>{L(BATCH_ROLE_LABEL[role])}</span>;
                        })()}
                        <span className={cn("me-1 rounded px-1 text-[10px] font-semibold", m.madeInChina ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300")}>{m.madeInChina ? "CN" : "IQ"}</span>
                        <bdi dir="ltr" className={cn("font-mono", batchRole(m, g.members) === "original" && "font-bold")}>{m.batchCode}</bdi>
                      </td>
                      <td className="py-1">
                        {kgf(m.kg)}
                        {m.partial && (
                          <span className="ms-1 text-[11px] text-violet-700 dark:text-violet-300" data-testid="carrier-group-partial">
                            ({L({ ku: `بەشێکی: ${m.parcels} لە ${m.allParcels} پاکێج، ئەوانەی لەم بارەدا گەیشتوون`, en: `part: ${m.parcels} of ${m.allParcels} parcels, those that came on this load`, ar: `جزء: ${m.parcels} من ${m.allParcels}`, zh: `部分：${m.allParcels} 件中的 ${m.parcels} 件` })})
                          </span>
                        )}
                      </td>
                      <td className="py-1">{kgf(m.liveKg)}{m.stillComing > 0 && <span className="ms-1 text-amber-700 dark:text-amber-300">· {m.stillComing} {L({ ku: "لە ڕێگا", en: "on the road", ar: "في الطريق", zh: "在途" })}</span>}</td>
                      {g.invoice && <td className="py-1">{share ? <bdi dir="ltr">{fmtUsd(share.costUsd)}</bdi> : "—"}{m.hasLoads && <span className="ms-1 text-amber-700 dark:text-amber-300">({L({ ku: "بارەکانی خۆی هەیە", en: "has its own loads", ar: "له شحنات خاصة", zh: "有自己的分批" })})</span>}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {g.invoice && (
            <div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted" data-testid="carrier-group-bar">
                <div className={cn("absolute inset-y-0 start-0 rounded-full transition-all duration-500", g.verdict === "short" ? "bg-rose-500" : "bg-sky-500")} style={{ width: `${Math.min(100, (g.oursKg / max) * 100)}%` }} />
                <div className="absolute -top-1 -bottom-1 w-0.5 bg-foreground" style={{ insetInlineStart: `${(billed / max) * 100}%` }} title={L({ ku: "کێشی وەسڵ", en: "Invoice weight", ar: "وزن الفاتورة", zh: "发票重量" })} />
              </div>
              <p className={cn("mt-1 text-xs font-medium", tone)} data-testid="carrier-group-verdict">
                {L({ ku: "ئێمە", en: "Ours", ar: "لدينا", zh: "我方" })} {kgf(g.oursKg)} · {L({ ku: "وەسڵ", en: "invoice", ar: "الفاتورة", zh: "发票" })} {kgf(billed)} —{" "}
                {g.verdict === "waiting" && L({ ku: `ماوە ${(billed - g.oursKg).toFixed(2)} kg، ${g.stillComing} پاکێج هێشتا لە ڕێگان`, en: `${(billed - g.oursKg).toFixed(2)} kg to come, ${g.stillComing} parcels on the road`, ar: `يتبقى ${(billed - g.oursKg).toFixed(2)} kg`, zh: `尚余 ${(billed - g.oursKg).toFixed(2)} kg` })}
                {g.verdict === "short" && L({ ku: `کۆمپانیا ${(billed - g.oursKg).toFixed(2)} kg زیاتری حیساب کردووە ≈ ${fmtUsd(-g.differenceUsd)} زیان`, en: `the carrier billed ${(billed - g.oursKg).toFixed(2)} kg more ≈ ${fmtUsd(-g.differenceUsd)} lost`, ar: `احتسبت الشركة ${(billed - g.oursKg).toFixed(2)} kg أكثر ≈ ${fmtUsd(-g.differenceUsd)} خسارة`, zh: `承运商多计 ${(billed - g.oursKg).toFixed(2)} kg ≈ ${fmtUsd(-g.differenceUsd)} 损失` })}
                {g.verdict === "ahead" && L({ ku: `+${(g.oursKg - billed).toFixed(2)} kg لە کڕیار زیاتر وەرگیراوە ≈ +${fmtUsd(g.differenceUsd)}`, en: `+${(g.oursKg - billed).toFixed(2)} kg more charged to customers ≈ +${fmtUsd(g.differenceUsd)}`, ar: `+${(g.oursKg - billed).toFixed(2)} kg ≈ +${fmtUsd(g.differenceUsd)}`, zh: `+${(g.oursKg - billed).toFixed(2)} kg ≈ +${fmtUsd(g.differenceUsd)}` })}
                {g.verdict === "even" && <><CheckCircle2 className="inline h-3.5 w-3.5" /> {L({ ku: "یەکسانە", en: "they agree", ar: "متطابق", zh: "一致" })}</>}
              </p>
            </div>
          )}

          {isAdmin && g.key && (
            <div className="flex flex-wrap items-end gap-2" data-testid="carrier-group-invoice">
              <FileText className="mb-2 h-4 w-4 text-muted-foreground" />
              <label className="grid gap-1 text-xs">
                {L({ ku: `کێشی وەسڵی ${g.key} (kg)`, en: `${g.key} invoice weight (kg)`, ar: `وزن فاتورة ${g.key}`, zh: `${g.key} 发票重量` })}
                <Input type="number" step="0.01" dir="ltr" value={kg} onChange={(e) => setKg(e.target.value)} onKeyDown={noEnter} className="h-8 w-32" data-testid="carrier-group-kg" />
              </label>
              <label className="grid gap-1 text-xs">
                {L({ ku: "پارەی وەسڵ ($)", en: "Invoice total ($)", ar: "إجمالي الفاتورة ($)", zh: "发票金额 ($)" })}
                <Input type="number" step="0.01" dir="ltr" value={usd} onChange={(e) => setUsd(e.target.value)} onKeyDown={noEnter} className="h-8 w-32" data-testid="carrier-group-usd" />
              </label>
              <label className="grid gap-1 text-xs">
                {L({ ku: "ڕۆژی گەیشتنی ئەم بارە", en: "Day this load arrived", ar: "يوم وصول هذه الشحنة", zh: "本批到达日期" })}
                <Input type="date" dir="ltr" value={day} onChange={(e) => setDay(e.target.value)} onKeyDown={noEnter} className="h-8 w-40" data-testid="carrier-group-day" />
              </label>
              <Button type="button" size="sm" disabled={save.isPending || !(Number(kg) > 0)} onClick={() => save.mutate({ batchId, billedKg: Number(kg), costUsd: Number(usd) || 0, arrivedOn: day || null })} data-testid="carrier-group-save">
                {L({ ku: "پاشەکەوت و دابەشکردن", en: "Save and share out", ar: "حفظ وتوزيع", zh: "保存并分摊" })}
              </Button>
              {g.invoice && (
                <Button type="button" size="sm" variant="ghost" disabled={reapply.isPending} onClick={() => reapply.mutate({ batchId })} title={L({ ku: "دوای تۆماری پاکێجی تر، دووبارە بەپێی کێشی نوێ دابەشی بکە", en: "After more parcels, share out again by the new weights", ar: "أعد التوزيع بالأوزان الجديدة", zh: "按新重量重新分摊" })}>
                  <RefreshCw className="me-1 h-4 w-4" />
                  {L({ ku: "دووبارە دابەشکردن", en: "Share out again", ar: "إعادة التوزيع", zh: "重新分摊" })}
                </Button>
              )}
            </div>
          )}
          {!g.key && (
            <p className="text-xs text-muted-foreground">
              {L({ ku: "بۆ وەسڵی کۆمپانیا، لە «زانیاری سەرەتایی» ژمارەی باچی کۆمپانیا بنووسە (بۆ نموونە ANC 169).", en: "For the carrier's invoice, write the carrier batch number under the first tab (e.g. ANC 169).", ar: "اكتب رقم دفعة الشركة (مثلاً ANC 169).", zh: "请填写承运商批次号（如 ANC 169）。" })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** The live line on the scan screens: invoice, ours, to come (owner, 2026-10-28). */
export function CarrierGroupStrip({ batchId }: { batchId: number | null | undefined }) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  // Every batch, in or out of a carrier group (owner, 2026-10-29).
  const q = trpc.batches.carrierGroup.kgCheck.useQuery({ batchId: batchId ?? 0 }, // A minute: this strip sits on the register and both scanners all day.
  { enabled: !!batchId, refetchInterval: 60_000, refetchIntervalInBackground: false });
  const g = q.data;
  if (!batchId || !g) return null;
  const inGroup = g.members.length > 1;
  const ours = (
    <span className="text-sky-700 dark:text-sky-300" data-testid="carrier-strip-ours">
      {inGroup && <>{L({ ku: "ئەم باچە", en: "This batch", ar: "هذه الدفعة", zh: "本批次" })} <b dir="ltr">{g.thisKg.toFixed(2)}</b> · </>}
      {inGroup
        ? <>{L({ ku: `هەموو ${g.members.length} باچەکە`, en: `All ${g.members.length} batches`, ar: `كل الدفعات ${g.members.length}`, zh: `全部 ${g.members.length} 批` })} <b dir="ltr">{g.oursKg.toFixed(2)}</b></>
        : <>{L({ ku: "ئێمە", en: "Ours", ar: "لدينا", zh: "我方" })} <b dir="ltr">{g.oursKg.toFixed(2)}</b></>}
      {g.stillComing > 0 && <span className="ms-1 text-xs text-amber-700 dark:text-amber-300">· {g.stillComing} {L({ ku: "لە ڕێگا", en: "on the road", ar: "في الطريق", zh: "在途" })}</span>}
    </span>
  );
  // Which batches the group is made of, by name and kilos: a batch missing here
  // has not been given the carrier's number (AIR-2026-069, owner 2026-10-31).
  const whichBatches = inGroup ? (
    <span className="basis-full text-xs text-muted-foreground" data-testid="carrier-strip-members">
      {g.members.map((m) => <span key={m.batchCode} className="me-3"><bdi dir="ltr">{m.batchCode}</bdi>: <b dir="ltr">{m.kg.toFixed(2)}</b></span>)}
    </span>
  ) : null;
  if (g.carrierKg == null) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-dashed px-3 py-2 text-sm tabular-nums text-muted-foreground" data-testid="carrier-group-strip" data-state="no-carrier-kg">
        {g.key && <span className="flex items-center gap-1 font-medium"><Link2 className="h-4 w-4" /><bdi dir="ltr">{g.key}</bdi></span>}
        {ours}
        <span>{g.key
          ? L({ ku: "وەسڵی کۆمپانیا لە کارتی گرووپ هێشتا نەنووسراوە", en: "The carrier's invoice is not on the group card yet", ar: "فاتورة الشركة لم تُكتب في بطاقة المجموعة بعد", zh: "承运商发票尚未录入组卡片" })
          : L({ ku: "کێشی کۆمپانیای گواستنەوە هێشتا نەنووسراوە", en: "The carrier's kilos are not entered yet", ar: "وزن شركة الشحن لم يُدخل بعد", zh: "承运商重量尚未录入" })}</span>
        {whichBatches}
      </div>
    );
  }
  const verdict = groupVerdict({ billedKg: g.carrierKg, oursKg: g.oursKg, stillComing: g.stillComing });
  const left = g.carrierKg - g.oursKg;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm tabular-nums",
      verdict === "short" ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200" : "bg-card")}
      data-testid="carrier-group-strip" data-state={verdict}>
      {g.key && <span className="flex items-center gap-1 font-medium"><Link2 className="h-4 w-4" /><bdi dir="ltr">{g.key}</bdi></span>}
      <span>{L({ ku: "کۆمپانیا", en: "Carrier", ar: "الشركة", zh: "承运商" })} <b dir="ltr">{g.carrierKg.toFixed(2)}</b></span>
      {ours}
      <span className={left > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
        {left > 0 ? L({ ku: "ماوە", en: "To come", ar: "يتبقى", zh: "尚余" }) : L({ ku: "زیاتر", en: "Over", ar: "زيادة", zh: "超出" })} <b dir="ltr">{Math.abs(left).toFixed(2)} kg</b>
      </span>
      {whichBatches}
    </div>
  );
}
