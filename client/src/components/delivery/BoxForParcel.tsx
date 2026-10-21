import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Package, PackagePlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSystemAlert } from "@/components/SystemAlert";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { HANDOVER_LABELS, type HandoverMode } from "@shared/boxHandover";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * «بۆکس دروست بکە بۆی» - from Quick Register straight into the customer's
 * box (owner, 2026-10-21).
 *
 * After a parcel is registered: the customer's box still being filled (no
 * receipt printed or sent for it), or a new box made the way the newest one
 * went out - the same driver or company, delivery cost and price, phone and
 * address - with no field to touch. ↑ ↓ choose, Enter goes on. The parcel is
 * put in, and the box opens on its scan field (server/db/boxHandover.db.ts:
 * boxChoiceForCustomer).
 */
export function BoxForParcel({
  customerId,
  customerName,
  trackingNumber,
  language,
}: {
  customerId: number;
  customerName: string;
  trackingNumber: string;
  language: string;
}) {
  const L = (w: Words) => pickLang(language, w);
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const systemAlert = useSystemAlert();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<"open" | "new">("new");
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = trpc.deliveryBox.choiceForCustomer.useQuery({ customerId }, { enabled: open, staleTime: 0 });
  const create = trpc.deliveryBox.create.useMutation();
  const addItem = trpc.deliveryBox.addItem.useMutation();

  // The box still being filled is offered first, when there is one.
  useEffect(() => { if (data) setChoice(data.open ? "open" : "new"); }, [data]);

  const way = (mode: HandoverMode | null | undefined, carrier: string | null | undefined) =>
    mode ? `${L(HANDOVER_LABELS[mode])}${carrier ? ` — ${carrier}` : ""}` : L({ ku: "شێوازی گەیاندن دیاری نەکراوە", en: "No way chosen yet", ar: "لم تُحدد طريقة التوصيل", zh: "未选择送货方式" });

  const go = async () => {
    if (!data || busy) return;
    setBusy(true);
    try {
      let boxId: number;
      if (choice === "open" && data.open) {
        boxId = data.open.id;
      } else {
        const last = data.last;
        const made = await create.mutateAsync({
          customerId,
          deliveryMethod: last?.deliveryMethod ?? "warehouse_pickup",
          destinationCity: last?.destinationCity ?? undefined,
          destinationAddress: last?.destinationAddress ?? undefined,
          recipientPhone: last?.recipientPhone ?? undefined,
          deliveryCostUsd: last?.deliveryCostUsd ?? "0",
          deliveryChargeUsd: last?.deliveryChargeUsd ?? "0",
          // The way the last box went; a first box (or one that went by
          // pickup) is collected by the customer.
          handover: last?.handoverMode
            ? { mode: last.handoverMode, carrierId: last.carrierId }
            : (!last || last.deliveryMethod === "warehouse_pickup") ? { mode: "pickup" } : undefined,
        });
        boxId = Number(made.id);
      }
      try {
        await addItem.mutateAsync({ boxId, trackingNumber });
      } catch (err: any) {
        // The box is there either way; the refusal (already in a box, another
        // customer's...) is read, and the box opens for the person to see.
        systemAlert({
          kind: "warning",
          title: L({ ku: "پاکێجەکە نەخرایە بۆکسەکە", en: "The parcel was not put in the box", ar: "لم يُضف الطرد إلى الصندوق", zh: "包裹未放入箱子" }),
          message: err?.message ?? String(err),
        });
      }
      void utils.deliveryBox.invalidate();
      setOpen(false);
      setLocation(`/customer-delivery-scanner?box=${boxId}`);
    } catch (err: any) {
      systemAlert({
        kind: "error",
        title: L({ ku: "بۆکس دروست نەکرا", en: "The box was not made", ar: "لم يُنشأ الصندوق", zh: "未能创建箱子" }),
        message: err?.message ?? String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!data) return;
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && data.open) {
      e.preventDefault();
      setChoice((c) => (c === "open" ? "new" : "open"));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void go();
    }
  };

  const option = (key: "open" | "new", title: string, lines: string[]) => (
    <button
      type="button"
      onClick={() => setChoice(key)}
      onDoubleClick={() => { setChoice(key); void go(); }}
      className={cn(
        "w-full rounded-xl border-2 p-3 text-start transition-colors",
        choice === key ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
      )}
      data-testid={`box-choice-${key}`}
      aria-pressed={choice === key}
    >
      <span className="flex items-center gap-2 font-semibold">
        <span className={cn("h-3 w-3 shrink-0 rounded-full border-2", choice === key ? "border-primary bg-primary" : "border-muted-foreground")} />
        {title}
      </span>
      {lines.map((l) => (
        <span key={l} className="mt-0.5 block ps-5 text-xs text-muted-foreground">{l}</span>
      ))}
    </button>
  );

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1.5"
        data-testid="qr-box-for-parcel"
      >
        <PackagePlus className="h-3.5 w-3.5" />
        {L({ ku: "بۆکس دروست بکە بۆی", en: "Box it", ar: "أنشئ صندوقاً له", zh: "为其装箱" })}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" onKeyDown={onKeyDown} data-testid="box-for-parcel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {L({ ku: `بۆکس بۆ ${customerName}`, en: `A box for ${customerName}`, ar: `صندوق لـ ${customerName}`, zh: `为 ${customerName} 装箱` })}
            </DialogTitle>
          </DialogHeader>
          {isLoading || !data ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {data.open && option(
                "open",
                `${L({ ku: "بۆکسی کراوە", en: "The open box", ar: "الصندوق المفتوح", zh: "未完成的箱子" })}: ${data.open.boxCode}`,
                [
                  `${data.open.totalPackages} ${L({ ku: "پاکێج · هێشتا وەسڵی بۆ نەچووە", en: "parcel(s) · no receipt sent yet", ar: "طرد · لم يُرسل إيصال بعد", zh: "件 · 尚未发送收据" })}`,
                  way(data.open.handoverMode as HandoverMode | null, data.open.carrierName),
                ],
              )}
              {option(
                "new",
                L({ ku: "بۆکسی نوێ", en: "A new box", ar: "صندوق جديد", zh: "新箱子" }),
                data.last
                  ? [
                      `${way(data.last.handoverMode, data.last.carrierName)} · $${Number(data.last.deliveryChargeUsd || 0).toFixed(2)}`,
                      L({ ku: "وەک دوایین بۆکسی ئەم کڕیارە", en: "As this customer's last box", ar: "كآخر صندوق لهذا العميل", zh: "同该客户上一个箱子" }),
                    ]
                  : [L({ ku: "کڕیار خۆی دێت - یەکەم بۆکسی ئەم کڕیارە", en: "Customer collects - this customer's first box", ar: "يستلم بنفسه - أول صندوق لهذا العميل", zh: "客户自取 - 该客户的第一个箱子" })],
              )}
              <p className="text-[11px] text-muted-foreground">
                {L({ ku: "↑ ↓ هەڵبژاردن · Enter بەردەوام بە", en: "↑ ↓ to choose · Enter to go on", ar: "↑ ↓ للاختيار · Enter للمتابعة", zh: "↑ ↓ 选择 · Enter 继续" })}
              </p>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              {L({ ku: "هەڵوەشاندنەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </Button>
            <Button onClick={() => void go()} disabled={!data || busy} className="flex-1" data-testid="box-for-parcel-go">
              {busy && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {L({ ku: "بەردەوام بە ↵", en: "Go on ↵", ar: "متابعة ↵", zh: "继续 ↵" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
