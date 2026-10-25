import { useState } from "react";
import { CheckCircle2, Clock, PackageCheck, Plus, Save, Trash2, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { confirmDanger } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CarrierPartsVerdict } from "@shared/carrierParts";

/**
 * The loads the carrier brings one batch in, and how much of the batch has
 * reached Erbil (owner, 2026-10-25). AIR-2026-069GZ: 233 kg registered in
 * China, the first invoice 74 kg - "+$1,402 extra profit" was the rest of the
 * goods still on the road. Here each load is its own invoice, the arrival
 * check says what came, and a bill far under our weight (shared/carrierParts)
 * holds the profit until the next load - or until an admin says why.
 *
 * Sits inside the batch edit form: every button is type="button" and no
 * field has a name, so nothing here is saved by the form's own Save.
 */

export interface CarrierLoad {
  id: number;
  partNo: number;
  arrivedOn: string | null;
  billedKg: string | null;
  billedCbm: string | null;
  costUsd: string | null;
  awbNumber: string | null;
  note: string | null;
}

export interface CarrierPartsSummary {
  verdict: CarrierPartsVerdict;
  loads: CarrierLoad[];
  registered: { count: number; kg: number };
  arrived: { count: number; kg: number };
  carrierKg: number;
  accepted: { at: string | Date; byId: number | null; note: string | null } | null;
}

interface Draft {
  arrivedOn: string;
  billed: string;
  costUsd: string;
  awbNumber: string;
}

const EMPTY: Draft = { arrivedOn: "", billed: "", costUsd: "", awbNumber: "" };
const noEnter = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") e.preventDefault();
};

export function CarrierPartsCard({
  batchId,
  shippingType,
  summary,
  onChanged,
}: {
  batchId: number;
  shippingType: string;
  summary: CarrierPartsSummary;
  onChanged: () => void;
}) {
  const { language } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const sea = shippingType === "sea";
  const unit = sea ? "CBM" : "kg";
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [accepting, setAccepting] = useState(false);
  const [reason, setReason] = useState("");

  const fail = (e: { message: string }) => toast.error(e.message);
  const add = trpc.batches.carrierParts.add.useMutation({ onSuccess: () => { setAdding(false); setDraft(EMPTY); onChanged(); }, onError: fail });
  const update = trpc.batches.carrierParts.update.useMutation({ onSuccess: () => { setEditingId(null); onChanged(); }, onError: fail });
  const remove = trpc.batches.carrierParts.remove.useMutation({ onSuccess: onChanged, onError: fail });
  const accept = trpc.batches.carrierParts.accept.useMutation({ onSuccess: () => { setAccepting(false); setReason(""); onChanged(); }, onError: fail });

  const payload = (d: Draft) => ({
    arrivedOn: d.arrivedOn || null,
    billedKg: sea ? null : d.billed || null,
    billedCbm: sea ? d.billed || null : null,
    costUsd: d.costUsd || null,
    awbNumber: d.awbNumber || null,
  });

  const onRoad = {
    count: Math.max(0, summary.registered.count - summary.arrived.count),
    kg: Math.max(0, Math.round((summary.registered.kg - summary.arrived.kg) * 100) / 100),
  };
  // A batch with one invoice typed the old way shows it as load 1.
  const legacyOne = summary.loads.length === 0 && summary.carrierKg > 0;

  const fields = (d: Draft, set: (d: Draft) => void) => (
    <>
      <Input type="date" value={d.arrivedOn} onChange={(e) => set({ ...d, arrivedOn: e.target.value })} onKeyDown={noEnter} className="h-8" aria-label={L({ ku: "ڕێکەوتی گەیشتن", en: "Arrived on", ar: "تاريخ الوصول", zh: "到达日期" })} />
      <Input type="number" step={sea ? "0.0001" : "0.01"} inputMode="decimal" dir="ltr" placeholder={unit} value={d.billed} onChange={(e) => set({ ...d, billed: e.target.value })} onKeyDown={noEnter} className="h-8" data-testid="carrier-part-billed" />
      <Input type="number" step="0.01" inputMode="decimal" dir="ltr" placeholder="$" value={d.costUsd} onChange={(e) => set({ ...d, costUsd: e.target.value })} onKeyDown={noEnter} className="h-8" data-testid="carrier-part-cost" />
      <Input dir="ltr" placeholder="AWB" value={d.awbNumber} onChange={(e) => set({ ...d, awbNumber: e.target.value })} onKeyDown={noEnter} className="h-8" />
    </>
  );

  const tile = (label: string, count: number, kg: number | null, tone: string, testId: string) => (
    <div className={`rounded-md border px-3 py-2 ${tone}`} data-testid={testId}>
      <div className="text-xs">{label}</div>
      {kg !== null && <div className="text-base font-semibold tabular-nums" dir="ltr">{kg.toFixed(2)} kg</div>}
      <div className="text-xs tabular-nums">{count} {L({ ku: "پاکێج", en: "parcels", ar: "طرد", zh: "件" })}</div>
    </div>
  );

  return (
    <div className="mt-3 space-y-3" data-testid="carrier-parts">
      <div className="grid grid-cols-3 gap-2">
        {tile(L({ ku: "تۆمارکراو", en: "Registered", ar: "مسجّل", zh: "已登记" }), summary.registered.count, sea ? null : summary.registered.kg, "bg-muted/40", "parts-registered")}
        {tile(L({ ku: "گەیشتووە (پشکنینی گەیاندن)", en: "Arrived (arrival check)", ar: "وصل (فحص الوصول)", zh: "已到（到货核对）" }), summary.arrived.count, sea ? null : summary.arrived.kg, "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200", "parts-arrived")}
        {tile(L({ ku: "هێشتا لە ڕێگایە", en: "Still on the road", ar: "ما زال في الطريق", zh: "仍在途中" }), onRoad.count, sea ? null : onRoad.kg, "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200", "parts-on-road")}
      </div>

      <div className="rounded-md border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Truck className="h-4 w-4" />
            {L({ ku: "بارەکانی کۆمپانیای گواستنەوە — هەر بارێک وەسڵی خۆی", en: "Carrier loads — one invoice each", ar: "شحنات الناقل — لكل شحنة فاتورتها", zh: "承运商分批 — 每批一张发票" })}
          </span>
          {isAdmin && !adding && (
            <Button type="button" variant="outline" size="sm" onClick={() => { setAdding(true); setDraft(EMPTY); }} data-testid="carrier-part-add">
              <Plus className="h-4 w-4 me-1" />
              {L({ ku: "بارێکی تر", en: "Another load", ar: "شحنة أخرى", zh: "再加一批" })}
            </Button>
          )}
        </div>
        <div className="divide-y text-sm">
          {legacyOne && (
            <div className="grid grid-cols-[3.5rem_1fr_1fr] gap-2 px-3 py-2 tabular-nums">
              <span>{L({ ku: "بار 1", en: "Load 1", ar: "الشحنة 1", zh: "第1批" })}</span>
              <span dir="ltr" className="text-end">{summary.carrierKg.toFixed(2)} {unit}</span>
              <span className="text-xs text-muted-foreground">{L({ ku: "لە خانەکەی سەرەوە", en: "from the field above", ar: "من الحقل أعلاه", zh: "来自上方字段" })}</span>
            </div>
          )}
          {summary.loads.map((p) => editingId === p.id ? (
            <div key={p.id} className="grid grid-cols-2 gap-2 px-3 py-2 sm:grid-cols-[3.5rem_repeat(4,minmax(0,1fr))_auto]">
              <span className="self-center">{L({ ku: `بار ${p.partNo}`, en: `Load ${p.partNo}`, ar: `الشحنة ${p.partNo}`, zh: `第${p.partNo}批` })}</span>
              {fields(editDraft, setEditDraft)}
              <div className="flex gap-1">
                <Button type="button" size="sm" className="h-8" disabled={update.isPending} onClick={() => update.mutate({ id: p.id, ...payload(editDraft) })}><Save className="h-4 w-4" /></Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)} data-mouse-close><X className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <div key={p.id} className="grid grid-cols-2 items-center gap-2 px-3 py-2 tabular-nums sm:grid-cols-[3.5rem_repeat(4,minmax(0,1fr))_auto]" data-testid="carrier-part-row">
              <span>{L({ ku: `بار ${p.partNo}`, en: `Load ${p.partNo}`, ar: `الشحنة ${p.partNo}`, zh: `第${p.partNo}批` })}</span>
              <span dir="ltr" className="text-end">{p.arrivedOn ?? "—"}</span>
              <span dir="ltr" className="text-end">{(sea ? p.billedCbm : p.billedKg) ? `${Number(sea ? p.billedCbm : p.billedKg).toFixed(sea ? 4 : 2)} ${unit}` : "—"}</span>
              <span dir="ltr" className="text-end">{p.costUsd ? fmtUsd(Number(p.costUsd)) : "—"}</span>
              <span dir="ltr" className="truncate text-end">{p.awbNumber ?? "—"}</span>
              {isAdmin ? (
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingId(p.id); setEditDraft({ arrivedOn: p.arrivedOn ?? "", billed: (sea ? p.billedCbm : p.billedKg) ?? "", costUsd: p.costUsd ?? "", awbNumber: p.awbNumber ?? "" }); }}>
                    {L({ ku: "گۆڕین", en: "Edit", ar: "تعديل", zh: "编辑" })}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-red-600 dark:text-red-400" disabled={remove.isPending}
                    onClick={async () => { if (await confirmDanger(L({ ku: `بار ${p.partNo} بسڕدرێتەوە؟`, en: `Remove load ${p.partNo}?`, ar: `حذف الشحنة ${p.partNo}؟`, zh: `删除第${p.partNo}批？` }))) remove.mutate({ id: p.id }); }}
                    aria-label={L({ ku: "سڕینەوە", en: "Remove", ar: "حذف", zh: "删除" })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : <span />}
            </div>
          ))}
          {adding && (
            <div className="grid grid-cols-2 gap-2 bg-muted/30 px-3 py-2 sm:grid-cols-[3.5rem_repeat(4,minmax(0,1fr))_auto]" data-testid="carrier-part-new">
              <span className="self-center text-xs">{L({ ku: "باری نوێ", en: "New load", ar: "شحنة جديدة", zh: "新批次" })}</span>
              {fields(draft, setDraft)}
              <div className="flex gap-1">
                <Button type="button" size="sm" className="h-8" disabled={add.isPending || !(Number(draft.billed) > 0 || Number(draft.costUsd) > 0)}
                  onClick={() => add.mutate({ batchId, ...payload(draft) })} data-testid="carrier-part-save">
                  <Save className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setAdding(false)} data-mouse-close><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
          {summary.loads.length === 0 && !legacyOne && !adding && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {L({ ku: "هێشتا هیچ وەسڵێکی کۆمپانیای گواستنەوە نەنووسراوە.", en: "No carrier invoice entered yet.", ar: "لم تُدخل أي فاتورة للناقل بعد.", zh: "尚未录入承运商发票。" })}
            </p>
          )}
        </div>
        {summary.loads.length > 0 && (
          <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            {L({ ku: "کۆی بارەکان دەبێتە کێش و تێچووی باچ.", en: "The loads' sums are the batch's billed weight and cost.", ar: "مجموع الشحنات هو وزن الدفعة وتكلفتها.", zh: "各批合计即该批次计费重量与成本。" })}
          </p>
        )}
      </div>

      {summary.verdict === "partial" && (
        <div className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" data-testid="carrier-parts-partial">
          <p className="flex items-center gap-1.5 font-medium">
            <Clock className="h-4 w-4 shrink-0" />
            {L({
              ku: `کۆمپانیا ${summary.carrierKg.toFixed(2)} kg ی حیساب کردووە لە ${summary.registered.kg.toFixed(2)} kg — کارتۆن/بارێک دیار نییە. قازانج چاوەڕێی باری ترە.`,
              en: `The carrier billed ${summary.carrierKg.toFixed(2)} kg of ${summary.registered.kg.toFixed(2)} kg — a carton or load is missing. Profit waits for the next load.`,
              ar: `احتسبت الشركة ${summary.carrierKg.toFixed(2)} kg من ${summary.registered.kg.toFixed(2)} kg — كرتونة أو شحنة مفقودة. الربح بانتظار الشحنة التالية.`,
              zh: `承运商计费 ${summary.carrierKg.toFixed(2)} kg / 共 ${summary.registered.kg.toFixed(2)} kg — 缺一箱或一批。利润待下一批。`,
            })}
          </p>
          {!sea && summary.arrived.count > 0 && (
            <p className="mt-1 text-xs tabular-nums">
              {L({
                ku: `گەیشتوو ${summary.arrived.kg.toFixed(2)} kg · حیسابکراو ${summary.carrierKg.toFixed(2)} kg`,
                en: `Arrived ${summary.arrived.kg.toFixed(2)} kg · billed ${summary.carrierKg.toFixed(2)} kg`,
                ar: `وصل ${summary.arrived.kg.toFixed(2)} kg · محتسب ${summary.carrierKg.toFixed(2)} kg`,
                zh: `已到 ${summary.arrived.kg.toFixed(2)} kg · 计费 ${summary.carrierKg.toFixed(2)} kg`,
              })}
            </p>
          )}
          {isAdmin && !accepting && (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setAccepting(true)} data-testid="carrier-parts-accept">
              {L({ ku: "دەزانم هۆکارەکە چییە — چاوەڕێ مەکە", en: "I know why — don't wait", ar: "أعرف السبب — لا تنتظر", zh: "我知道原因 — 不再等待" })}
            </Button>
          )}
          {accepting && (
            <div className="mt-2 space-y-2">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                placeholder={L({ ku: "هۆکار: بۆ نموونە کارتۆنێک ون بوو، یان لەگەڵ باچێکی تر هات", en: "Reason: e.g. a carton was lost, or it came on another batch", ar: "السبب: مثلاً ضاعت كرتونة أو جاءت مع دفعة أخرى", zh: "原因：如丢失一箱，或随其他批次到达" })}
                data-testid="carrier-parts-reason" />
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={reason.trim().length < 3 || accept.isPending} onClick={() => accept.mutate({ batchId, note: reason.trim() })} data-testid="carrier-parts-accept-save">
                  {L({ ku: "پاشەکەوت", en: "Save", ar: "حفظ", zh: "保存" })}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAccepting(false)} data-mouse-close>
                  {L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {summary.verdict === "accepted" && summary.accepted && (
        <div className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200" data-testid="carrier-parts-accepted">
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {L({ ku: "ئادمین وتی چاوەڕێ مەکە:", en: "An admin said not to wait:", ar: "قال المدير لا تنتظر:", zh: "管理员确认不再等待：" })} {summary.accepted.note}
          </p>
          {isAdmin && (
            <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2" disabled={accept.isPending} onClick={() => accept.mutate({ batchId, note: null })}>
              {L({ ku: "گەڕاندنەوە", en: "Undo", ar: "تراجع", zh: "撤销" })}
            </Button>
          )}
        </div>
      )}

      {summary.verdict === "whole" && summary.arrived.count > 0 && summary.arrived.count === summary.registered.count && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
          <PackageCheck className="h-4 w-4" />
          {L({ ku: "هەموو پاکێجەکان گەیشتوون.", en: "Every parcel has arrived.", ar: "وصلت كل الطرود.", zh: "所有包裹均已到达。" })}
        </p>
      )}
    </div>
  );
}
