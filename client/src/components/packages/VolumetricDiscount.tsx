import { useEffect, useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSystemAlert } from "@/components/SystemAlert";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

type Words = { ku: string; en: string; ar: string; zh: string };

const kg = (n: number) => `${Number(n.toFixed(2))} kg`;
const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * A volumetric discount (owner, 2026-10-23): a parcel of 5 kg on the scale
 * and 12 kg by volume charged as 7 kg. The sides are not touched - the
 * volumetric figures stay true - only the kilos charged are written, and the
 * price, the account and the box follow (packages.setBilledWeight).
 *
 * One window, opened from All Packages, Quick Register and the box before its
 * receipt. The caller shows the button only for an air parcel whose volume
 * weighs more than its scale; the window asks the server for the figures.
 */
export function VolumetricDiscountButton({
  packageId,
  billedKg,
  language,
  onDone,
  className,
}: {
  packageId: number;
  /** The kilos charged now when a discount is on, so the button says so. */
  billedKg?: number | null;
  language: string;
  onDone?: () => void;
  className?: string;
}) {
  const L = (w: Words) => pickLang(language, w);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={cn(
          "h-6 gap-1 px-1.5 text-[11px]",
          billedKg ? "border-emerald-400 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300" : "border-amber-300 text-amber-700 dark:border-amber-800/60 dark:text-amber-300",
          className,
        )}
        data-testid="volumetric-discount-open"
      >
        <Scale className="h-3 w-3" />
        {billedKg
          ? `${kg(billedKg)} · ${L({ ku: "داشکاوە", en: "discounted", ar: "مخفّض", zh: "已优惠" })}`
          : L({ ku: "داشکانی قەبارە", en: "Volume discount", ar: "خصم الحجم", zh: "体积优惠" })}
      </Button>
      {open && <VolumetricDiscountDialog packageId={packageId} language={language} onClose={() => setOpen(false)} onDone={onDone} />}
    </>
  );
}

/**
 * The button, only when this parcel is billed on its volume - for a screen
 * that does not hold the parcel's sides itself (Quick Register's last
 * registration).
 */
export function VolumetricDiscountIfDue({ packageId, language }: { packageId: number; language: string }) {
  const facts = trpc.packages.volumetricFacts.useQuery({ packageId }, { staleTime: 30_000 });
  const f = facts.data;
  if (!f?.eligible || f.receipted) return null;
  return <VolumetricDiscountButton packageId={packageId} billedKg={f.billedKg} language={language} className="h-8" />;
}

function VolumetricDiscountDialog({
  packageId,
  language,
  onClose,
  onDone,
}: {
  packageId: number;
  language: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const L = (w: Words) => pickLang(language, w);
  const utils = trpc.useUtils();
  const systemAlert = useSystemAlert();
  const facts = trpc.packages.volumetricFacts.useQuery({ packageId }, { staleTime: 0 });
  const [typed, setTyped] = useState("");
  const f = facts.data;
  useEffect(() => {
    if (f) setTyped(String(Number((f.billedKg ?? f.volumetricKg).toFixed(2))));
  }, [f?.billedKg, f?.volumetricKg]);

  const save = trpc.packages.setBilledWeight.useMutation({
    onSuccess: (r) => {
      toast.success(
        r.billedWeightKg
          ? L({ ku: `${Number(r.billedWeightKg)} kg حیساب کرا`, en: `Charged as ${Number(r.billedWeightKg)} kg`, ar: `احتُسب ${Number(r.billedWeightKg)} kg`, zh: `按 ${Number(r.billedWeightKg)} kg 计费` })
          : L({ ku: "داشکان لابرا", en: "Discount removed", ar: "أُزيل الخصم", zh: "已取消优惠" }),
      );
      void utils.packages.invalidate();
      void utils.deliveryBox.invalidate();
      onDone?.();
      onClose();
    },
    onError: (err) => {
      systemAlert({
        kind: "error",
        title: L({ ku: "داشکان نەکرا", en: "The discount was not saved", ar: "لم يُحفظ الخصم", zh: "优惠未保存" }),
        message: err.message,
      });
    },
  });

  const n = parseFloat(typed);
  const inRange = f ? Number.isFinite(n) && n >= f.actualKg - 0.0005 && n <= f.volumetricKg + 0.0005 : false;
  const newPrice = f?.rate && inRange ? f.rate * n : null;
  const fullPrice = f?.rate ? f.rate * f.volumetricKg : null;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="volumetric-discount">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            {L({ ku: "داشکانی قەبارە", en: "Volume discount", ar: "خصم الحجم", zh: "体积优惠" })}
          </DialogTitle>
        </DialogHeader>
        {!f ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !f.eligible ? (
          <p className="text-sm text-muted-foreground">
            {L({ ku: "ئەم پاکەتە کێشی قەبارەیی لە کێشی ڕاستەقینەی زیاتر نییە.", en: "This parcel's volume does not weigh more than its scale.", ar: "وزن هذا الطرد الحجمي ليس أكبر من وزنه الفعلي.", zh: "该包裹体积重不大于实际重量。" })}
          </p>
        ) : f.receipted ? (
          <p className="text-sm text-muted-foreground">
            {L({ ku: "پارەی ئەم پاکەتە لە وەسڵدا وەرگیراوە. بۆ داشکان، سەرەتا وەسڵی بۆکسەکە هەڵبوەشێنەوە.", en: "This parcel is paid on a receipt. Undo the box's receipt first.", ar: "دُفع هذا الطرد بإيصال. ألغِ إيصال الصندوق أولاً.", zh: "该包裹已在收据中付款，请先撤销箱子收据。" })}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border p-2">
                <p className="text-[11px] text-muted-foreground">{L({ ku: "کێشی ڕاستەقینە", en: "Scale", ar: "الوزن الفعلي", zh: "实际重量" })}</p>
                <p className="font-bold tabular-nums" dir="ltr">{kg(f.actualKg)}</p>
              </div>
              <div className="rounded-lg border border-amber-300 p-2 dark:border-amber-800/60">
                <p className="text-[11px] text-muted-foreground">{L({ ku: "کێشی قەبارەیی", en: "By volume", ar: "الوزن الحجمي", zh: "体积重" })}</p>
                <p className="font-bold tabular-nums text-amber-700 dark:text-amber-300" dir="ltr">{kg(f.volumetricKg)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="volumetric-billed">
                {L({ ku: "کێشی حیسابکراو", en: "Kilos to charge", ar: "الوزن المحتسب", zh: "计费重量" })}
              </label>
              <Input
                id="volumetric-billed"
                type="number"
                step="0.1"
                min={f.actualKg}
                max={f.volumetricKg}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && inRange) { e.preventDefault(); save.mutate({ packageId, billedWeightKg: n }); } }}
                className={cn("h-11 text-lg font-bold tabular-nums", !inRange && typed !== "" && "border-red-400")}
                dir="ltr"
                autoFocus
                data-testid="volumetric-billed"
              />
              <p className={cn("text-[11px]", inRange ? "text-muted-foreground" : "text-red-600 dark:text-red-300")} dir="rtl">
                {L({
                  ku: `لە نێوان ${kg(f.actualKg)} و ${kg(f.volumetricKg)}`,
                  en: `Between ${kg(f.actualKg)} and ${kg(f.volumetricKg)}`,
                  ar: `بين ${kg(f.actualKg)} و ${kg(f.volumetricKg)}`,
                  zh: `介于 ${kg(f.actualKg)} 与 ${kg(f.volumetricKg)} 之间`,
                })}
              </p>
            </div>
            {fullPrice !== null && newPrice !== null && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30" data-testid="volumetric-preview">
                {L({ ku: "نرخ", en: "Price", ar: "السعر", zh: "价格" })}: <bdi dir="ltr" className="font-bold tabular-nums">{usd(newPrice)}</bdi>
                {newPrice < fullPrice - 0.005 && (
                  <span className="text-emerald-700 dark:text-emerald-300">
                    {" · "}{L({ ku: "داشکان", en: "discount", ar: "خصم", zh: "优惠" })} <bdi dir="ltr" className="font-bold tabular-nums">{usd(fullPrice - newPrice)}</bdi>
                  </span>
                )}
              </p>
            )}
          </div>
        )}
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          {f?.billedKg && f.eligible && !f.receipted && (
            <Button variant="outline" onClick={() => save.mutate({ packageId, billedWeightKg: null })} disabled={save.isPending} data-testid="volumetric-clear">
              {L({ ku: "لابردنی داشکان", en: "Remove discount", ar: "إزالة الخصم", zh: "取消优惠" })}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="flex-1">
            {L({ ku: "هەڵوەشاندنەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
          </Button>
          {f?.eligible && !f.receipted && (
            <Button onClick={() => save.mutate({ packageId, billedWeightKg: n })} disabled={!inRange || save.isPending} className="flex-1" data-testid="volumetric-save">
              {save.isPending && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {L({ ku: "پاشەکەوت", en: "Save", ar: "حفظ", zh: "保存" })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
