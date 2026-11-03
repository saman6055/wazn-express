import { useEffect, useState } from "react";
import { CheckCircle2, CopyPlus, FileText, Link2, Loader2 } from "lucide-react";
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
import { groupVerdict, splitInvoiceByHand } from "@shared/carrierGroup";

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
  // Kilos written per batch. Offered: the invoice wherever it was typed, and
  // each batch's own kilos less what an earlier load already billed
  // (owner, 2026-10-31: «من کێش و تێچووی گەیاندنم دا بەتۆ»).
  const [hand, setHand] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!g) return;
    const from = g.invoice ?? g.suggested;
    if (from) { setKg(String(from.billedKg)); setUsd(String(from.costUsd)); }
    const saved = g.invoice?.allocations ?? null;
    setHand(Object.fromEntries(g.members.map((m) => {
      const shared = g.shares.find((s) => s.batchId === m.batchId);
      const kilos = shared ? shared.billedKg : Math.max(0, m.realKg - m.earlierKg);
      return [m.batchId, (saved ? saved[m.batchId] ?? kilos : kilos).toFixed(2)];
    })));
  }, [q.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (q.isLoading) return null;
  const hasTwin = !!g?.members.some((m) => m.twinOfBatchId === batchId);
  const canTwin = isAdmin && madeInChina && shippingType !== "sea" && !hasTwin;
  if (!g && !canTwin) return null;

  const kgf = (n: number) => <bdi dir="ltr" className="tabular-nums">{n.toFixed(2)} kg</bdi>;
  const ids = (g?.members ?? []).map((m) => m.batchId);
  const given = Object.fromEntries(ids.slice(0, -1).map((id) => [String(id), Number(hand[id]) || 0]));
  const rows = splitInvoiceByHand(ids, given, Number(kg) || 0, Number(usd) || 0);
  const over = Object.values(given).reduce((s, n) => s + n, 0) > (Number(kg) || 0) + 0.005;

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
            <table className="w-full text-sm tabular-nums">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 text-start">{L({ ku: "باچ", en: "Batch", ar: "الدفعة", zh: "批次" })}</th>
                  <th className="py-1 text-start">{L({ ku: "کێشی فرۆشراو", en: "Kilos sold", ar: "الوزن المباع", zh: "售出重量" })}</th>
                  <th className="py-1 text-start">{L({ ku: "لەم وەسڵەدا", en: "On this invoice", ar: "في هذه الفاتورة", zh: "本发票" })}</th>
                  <th className="py-1 text-start">{L({ ku: "پارە", en: "Money", ar: "المبلغ", zh: "金额" })}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const m = g.members[i];
                  const role = batchRole(m, g.members);
                  const last = i === rows.length - 1;
                  return (
                    <tr key={m.batchId} className={cn("border-t", m.batchId === batchId && "bg-muted/40")} data-testid="carrier-group-member">
                      <td className="py-1.5">
                        <span className={cn("me-1 rounded px-1.5 py-px text-[10px] font-semibold", BATCH_ROLE_TONE[role])} data-testid="carrier-group-role" data-role={role}>{L(BATCH_ROLE_LABEL[role])}</span>
                        <bdi dir="ltr" className={cn("font-mono", role === "original" && "font-bold")}>{m.batchCode}</bdi>
                      </td>
                      <td className="py-1.5">{kgf(m.kg)}</td>
                      <td className="py-1.5">
                        {last || !isAdmin ? (
                          <span data-testid="carrier-group-rest">{kgf(row.billedKg)} {last && <span className="text-xs text-muted-foreground">{L({ ku: "ماوە", en: "the rest", ar: "الباقي", zh: "其余" })}</span>}</span>
                        ) : (
                          <Input type="number" step="0.01" dir="ltr" value={hand[m.batchId] ?? ""} onChange={(e) => setHand((was) => ({ ...was, [m.batchId]: e.target.value }))} onKeyDown={noEnter} className="h-8 w-28" data-testid="carrier-group-hand" />
                        )}
                        {m.earlierKg > 0 && <span className="ms-1 text-xs text-muted-foreground">+ {m.earlierKg.toFixed(2)} {L({ ku: "باری پێشوو", en: "earlier load", ar: "الشحنة السابقة", zh: "前批" })}</span>}
                      </td>
                      <td className="py-1.5"><bdi dir="ltr">{fmtUsd(row.costUsd)}</bdi></td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 font-semibold">
                  <td className="py-1.5">{L({ ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })}</td>
                  <td className="py-1.5">{kgf(g.members.reduce((s, m) => s + m.kg, 0))}</td>
                  <td className="py-1.5">{kgf(Number(kg) || 0)}</td>
                  <td className="py-1.5"><bdi dir="ltr">{fmtUsd(Number(usd) || 0)}</bdi></td>
                </tr>
              </tbody>
            </table>
          </div>

          {over && (
            <p className="text-xs font-medium text-red-700 dark:text-red-300" data-testid="carrier-group-over">
              {L({ ku: "کێشی نووسراو لە کێشی وەسڵ زیاترە. کێشی باچەکان کەم بکەرەوە.", en: "The kilos written are more than the invoice. Lower them.", ar: "الوزن المكتوب أكبر من الفاتورة.", zh: "填写重量超过发票。" })}
            </p>
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
              <Button type="button" size="sm" disabled={save.isPending || !(Number(kg) > 0) || over} onClick={() => save.mutate({ batchId, billedKg: Number(kg), costUsd: Number(usd) || 0, arrivedOn: g.invoice?.arrivedOn ?? null, allocations: given })} data-testid="carrier-group-save">
                {L({ ku: "پاشەکەوت بکە", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
              {g.invoice && <span className="mb-1.5 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300" data-testid="carrier-group-saved"><CheckCircle2 className="h-3.5 w-3.5" />{L({ ku: "پاشەکەوت کراوە", en: "Saved", ar: "محفوظ", zh: "已保存" })}</span>}
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
  // Our other batches' late cartons that came in this load (owner, 2026-11-03).
  const others = g.others ?? [];
  const othersKg = others.reduce((s, o) => s + o.kg, 0);
  const totalKg = g.oursKg + othersKg;
  const fromOthers = others.length > 0 ? (
    <>
      <span className="text-sky-700 dark:text-sky-300" data-testid="carrier-strip-others">
        {L({ ku: "باچی تری ئێمە", en: "Our other batches", ar: "دفعاتنا الأخرى", zh: "我方其他批次" })} <b dir="ltr">{othersKg.toFixed(2)}</b>
        {" · "}{L({ ku: "کۆی ئێمە", en: "All ours", ar: "مجموعنا", zh: "我方合计" })} <b dir="ltr">{totalKg.toFixed(2)}</b>
      </span>
      <span className="basis-full text-xs text-muted-foreground" data-testid="carrier-strip-others-list">
        {others.map((o) => <span key={o.batchCode} className="me-3"><bdi dir="ltr">{o.batchCode}</bdi>: <b dir="ltr">{o.kg.toFixed(2)}</b></span>)}
      </span>
    </>
  ) : null;
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
        {fromOthers}
        <span>{g.key
          ? L({ ku: "وەسڵی کۆمپانیا لە کارتی گرووپ هێشتا نەنووسراوە", en: "The carrier's invoice is not on the group card yet", ar: "فاتورة الشركة لم تُكتب في بطاقة المجموعة بعد", zh: "承运商发票尚未录入组卡片" })
          : L({ ku: "کێشی کۆمپانیای گواستنەوە هێشتا نەنووسراوە", en: "The carrier's kilos are not entered yet", ar: "وزن شركة الشحن لم يُدخل بعد", zh: "承运商重量尚未录入" })}</span>
        {whichBatches}
      </div>
    );
  }
  const verdict = groupVerdict({ billedKg: g.carrierKg, oursKg: totalKg, stillComing: g.stillComing });
  const left = g.carrierKg - totalKg;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm tabular-nums",
      verdict === "short" ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200" : "bg-card")}
      data-testid="carrier-group-strip" data-state={verdict}>
      {g.key && <span className="flex items-center gap-1 font-medium"><Link2 className="h-4 w-4" /><bdi dir="ltr">{g.key}</bdi></span>}
      <span>{L({ ku: "کۆمپانیا", en: "Carrier", ar: "الشركة", zh: "承运商" })} <b dir="ltr">{g.carrierKg.toFixed(2)}</b></span>
      {ours}
      {fromOthers}
      <span className={left > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
        {left > 0 ? L({ ku: "ماوە", en: "To come", ar: "يتبقى", zh: "尚余" }) : L({ ku: "زیاتر", en: "Over", ar: "زيادة", zh: "超出" })} <b dir="ltr">{Math.abs(left).toFixed(2)} kg</b>
      </span>
      {whichBatches}
    </div>
  );
}
