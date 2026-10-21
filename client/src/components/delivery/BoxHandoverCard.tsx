/**
 * «چۆن دەگاتە دەستی کڕیار؟» — how the box reaches the customer
 * (owner, 2026-10-19; shared/boxHandover).
 *
 * The customer collects it, our driver takes it, or a delivery company does.
 * Drivers and companies are added and removed right here; a removed one keeps
 * its name on the boxes it took. The company's tracking numbers are optional,
 * one per carton - they never hold the paper up. Since 2026-10-21 nothing
 * here holds the paper up either: the way is chosen when the box is made
 * (CreateBoxDialog), and this card keeps it on the box - who took it.
 */
import { useEffect, useState } from "react";
import { Plus, X, Truck, Warehouse, CircleUser, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  HANDOVER_LABELS,
  MONEY_WITH,
  handoverProblem,
  parseCarrierTrackings,
  type CarrierKind,
  type HandoverMode,
} from "@shared/boxHandover";

type Words = { ku: string; en: string; ar: string; zh: string };

export interface HandoverBox {
  id: number;
  status: string;
  handoverMode?: string | null;
  carrierId?: number | null;
  carrierName?: string | null;
  carrierTrackings?: string | null;
}

const ICONS: Record<HandoverMode, typeof Truck> = { pickup: Warehouse, driver: CircleUser, courier: Truck };

export function BoxHandoverCard({ box, paid, onChanged }: { box: HandoverBox; paid: boolean; onChanged: () => void }) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const utils = trpc.useUtils();
  const mode = (box.handoverMode ?? null) as HandoverMode | null;
  const [picking, setPicking] = useState<HandoverMode | null>(mode);
  // Chosen, it is one line (owner, 2026-10-21: the box was crowded); «گۆڕین» opens it.
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [trackings, setTrackings] = useState<string[]>(() => {
    const t = parseCarrierTrackings(box.carrierTrackings);
    return t.length ? t : [""];
  });
  useEffect(() => { setPicking(mode); }, [mode]);
  useEffect(() => {
    const t = parseCarrierTrackings(box.carrierTrackings);
    setTrackings(t.length ? t : [""]);
  }, [box.carrierTrackings]);

  const kind: CarrierKind | null = picking === "driver" || picking === "courier" ? picking : null;
  const list = trpc.deliveryBox.carriers.useQuery({ kind: kind ?? "driver" }, { enabled: kind !== null });

  const save = trpc.deliveryBox.setHandover.useMutation({
    onSuccess: () => { onChanged(); },
    onError: (e) => toast.error(e.message, { duration: 12_000 }),
  });
  const add = trpc.deliveryBox.addCarrier.useMutation({
    onSuccess: (c) => {
      setNewName(""); setNewPhone("");
      void utils.deliveryBox.carriers.invalidate();
      if (kind) save.mutate({ boxId: box.id, mode: kind, carrierId: c.id, trackings: kind === "courier" ? trackings : [] });
    },
    onError: (e) => toast.error(e.message, { duration: 12_000 }),
  });
  const remove = trpc.deliveryBox.removeCarrier.useMutation({
    onSuccess: () => { void utils.deliveryBox.carriers.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const chooseMode = (m: HandoverMode) => {
    setPicking(m);
    if (m === "pickup") save.mutate({ boxId: box.id, mode: "pickup" });
  };
  const chooseCarrier = (id: number) => {
    if (!kind) return;
    save.mutate({ boxId: box.id, mode: kind, carrierId: id, trackings: kind === "courier" ? trackings : [] });
  };
  const saveTrackings = (next: string[]) => {
    if (mode !== "courier" || !box.carrierId) return;
    save.mutate({ boxId: box.id, mode: "courier", carrierId: box.carrierId, trackings: next });
  };

  const problem = handoverProblem(box);
  const gone = box.status === "in_transit" || box.status === "delivered";

  if (!problem && !editing && mode) {
    const Icon = ICONS[mode];
    const sent = parseCarrierTrackings(box.carrierTrackings);
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-50/50 px-3 py-2 dark:bg-emerald-950/20" data-testid="box-handover">
        <Icon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
        <span className="text-sm font-medium" data-testid="handover-line">
          {L(HANDOVER_LABELS[mode])}{box.carrierName ? ` — ${box.carrierName}` : ""}
        </span>
        {sent.length > 0 && (
          <bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{sent.join(" · ")}</bdi>
        )}
        {mode !== "pickup" && gone && !paid && (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" data-testid="money-with">
            {L(MONEY_WITH[mode])}{box.carrierName ? ` (${box.carrierName})` : ""}
          </span>
        )}
        <Button type="button" size="sm" variant="ghost" className="ms-auto h-7 gap-1 px-2 text-xs" onClick={() => setEditing(true)} data-testid="handover-change">
          <Pencil className="h-3.5 w-3.5" />
          {L({ ku: "گۆڕین", en: "Change", ar: "تغيير", zh: "更改" })}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-lg border p-3", problem ? "border-amber-500/50" : "border-emerald-500/40")} data-testid="box-handover">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Truck className="h-4 w-4" />
          {L({ ku: "چۆن دەگاتە دەستی کڕیار؟", en: "How does it reach the customer?", ar: "كيف يصل إلى الزبون؟", zh: "如何送到客户手中？" })}
          <span className="text-red-600 dark:text-red-400">*</span>
        </p>
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {editing && !problem && (
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)} data-testid="handover-done">
            {L({ ku: "تەواو", en: "Done", ar: "تم", zh: "完成" })}
          </Button>
        )}
        {mode && mode !== "pickup" && gone && !paid && (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" data-testid="money-with">
            {L(MONEY_WITH[mode])}{box.carrierName ? ` (${box.carrierName})` : ""}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["pickup", "driver", "courier"] as HandoverMode[]).map((m) => {
          const Icon = ICONS[m];
          return (
            <button
              key={m}
              type="button"
              onClick={() => chooseMode(m)}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs sm:text-sm",
                picking === m ? "border-2 border-primary bg-primary/10 font-medium" : "hover:bg-muted",
              )}
              data-testid={`handover-${m}`}
            >
              <Icon className="h-4 w-4" />
              {L(HANDOVER_LABELS[m])}
            </button>
          );
        })}
      </div>

      {kind && (
        <div className="space-y-2 rounded-md border p-2.5">
          <p className="text-xs text-muted-foreground">
            {kind === "driver"
              ? L({ ku: "شۆفێرێک هەڵبژێرە — × بۆ لابردن لە لیست", en: "Choose a driver — × takes one off the list", ar: "اختر سائقاً — × لإزالته من القائمة", zh: "选择司机 — × 从列表移除" })
              : L({ ku: "کۆمپانیایەک هەڵبژێرە — × بۆ لابردن لە لیست", en: "Choose a company — × takes one off the list", ar: "اختر شركة — × لإزالتها من القائمة", zh: "选择公司 — × 从列表移除" })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(list.data ?? []).map((c) => {
              const on = mode === kind && Number(box.carrierId) === c.id;
              return (
                <span
                  key={c.id}
                  className={cn(
                    "inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-sm",
                    on ? "border-2 border-primary bg-primary/10 font-medium" : "hover:bg-muted",
                  )}
                  onClick={() => chooseCarrier(c.id)}
                  data-testid={`carrier-${c.id}`}
                >
                  {c.name}
                  {c.phone ? <bdi dir="ltr" className="text-xs text-muted-foreground">{c.phone}</bdi> : null}
                  <button
                    type="button"
                    aria-label={L({ ku: "لابردن", en: "Remove", ar: "إزالة", zh: "移除" })}
                    className="text-red-600 hover:text-red-800 dark:text-red-400"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirmAction({
                        title: L({ ku: `«${c.name}» لە لیست لابرێت؟`, en: `Take "${c.name}" off the list?`, ar: `إزالة «${c.name}» من القائمة؟`, zh: `从列表移除「${c.name}」？` }),
                        message: L({ ku: "لە بۆکسە کۆنەکاندا ناوەکەی دەمێنێت؛ تەنها لە لیستی هەڵبژاردن لادەچێت.", en: "Its name stays on the boxes it took; it only leaves the list.", ar: "يبقى اسمه على الصناديق السابقة؛ يُزال من القائمة فقط.", zh: "旧箱子上保留其名称；仅从选择列表中移除。" }),
                        confirmLabel: L({ ku: "بەڵێ، لایببە", en: "Yes, remove", ar: "نعم، أزل", zh: "是，移除" }),
                      });
                      if (ok) remove.mutate({ id: c.id });
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}
            {list.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={kind === "driver"
                ? L({ ku: "ناوی شۆفێری نوێ", en: "New driver's name", ar: "اسم سائق جديد", zh: "新司机姓名" })
                : L({ ku: "ناوی کۆمپانیای نوێ", en: "New company's name", ar: "اسم شركة جديدة", zh: "新公司名称" })}
              className="h-9 w-44"
              data-testid="carrier-new-name"
            />
            {kind === "driver" && (
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="07xx xxx xxxx" dir="ltr" className="h-9 w-36" />
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={add.isPending}
              onClick={() => {
                if (newName.trim().length < 2) {
                  toast.error(L({ ku: "ناوەکە بنووسە.", en: "Write the name.", ar: "اكتب الاسم.", zh: "请填写名称。" }));
                  return;
                }
                add.mutate({ kind, name: newName, phone: newPhone || undefined });
              }}
              data-testid="carrier-add"
            >
              <Plus className="me-1 h-3.5 w-3.5" />
              {L({ ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
            </Button>
          </div>

          {kind === "courier" && mode === "courier" && box.carrierId ? (
            <div className="space-y-1.5 border-t pt-2">
              <p className="text-xs text-muted-foreground">
                {L({ ku: "ژمارەی تراکی کۆمپانیا (ئارەزوومەندانە — بۆ هەر کارتۆنێک یەکێک)", en: "The company's tracking numbers (optional — one per carton)", ar: "أرقام تتبع الشركة (اختياري — رقم لكل كرتون)", zh: "快递单号（可选——每箱一个）" })}
              </p>
              {trackings.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-muted-foreground">{L({ ku: "کارتۆن", en: "Carton", ar: "كرتون", zh: "箱" })} {i + 1}</span>
                  <Input
                    value={t}
                    dir="ltr"
                    className="h-9 w-52 font-mono"
                    onChange={(e) => setTrackings((old) => old.map((v, j) => (j === i ? e.target.value : v)))}
                    onBlur={() => saveTrackings(trackings)}
                    data-testid={`carrier-tracking-${i}`}
                  />
                  <button
                    type="button"
                    aria-label={L({ ku: "سڕینەوە", en: "Delete", ar: "حذف", zh: "删除" })}
                    className="text-red-600 hover:text-red-800 dark:text-red-400"
                    onClick={() => {
                      const next = trackings.filter((_, j) => j !== i);
                      setTrackings(next.length ? next : [""]);
                      saveTrackings(next);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={() => setTrackings((old) => [...old, ""])} data-testid="carrier-tracking-add">
                <Plus className="me-1 h-3.5 w-3.5" />
                {L({ ku: "ژمارەیەکی تر", en: "Another number", ar: "رقم آخر", zh: "再加一个" })}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {problem ? (
        <p className="text-sm text-amber-700 dark:text-amber-300" data-testid="handover-problem">
          {L(problem)}
        </p>
      ) : (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {L(HANDOVER_LABELS[mode as HandoverMode])}{box.carrierName ? ` — ${box.carrierName}` : ""}
        </p>
      )}
    </div>
  );
}
