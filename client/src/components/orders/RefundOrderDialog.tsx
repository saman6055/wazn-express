import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { refundStockFigures } from "@shared/refusedGoods";

/**
 * «ڕیفەند» on an order: the goods went back to the seller in China, who paid
 * for them (owner, 2026-10-26). The customer no longer owes for them and pays
 * the return fee; the company loses only what the seller did not refund.
 * Every figure is shown before the main admin presses the button.
 */
export function RefundOrderDialog({
  order,
  onClose,
  onDone,
}: {
  order: { id: number; orderCode: string; productName?: string | null } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const [quantity, setQuantity] = useState(1);
  const [refund, setRefund] = useState<string | null>(null);
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setQuantity(1);
    setRefund(null);
    setFee("");
    setNote("");
  }, [order?.id]);

  const preview = trpc.ledger.previewRefusal.useQuery(
    { orderId: order?.id ?? 0, refuseQuantity: quantity },
    { enabled: order != null, retry: false },
  );
  const p = preview.data;
  // A whole order by default: once the piece count is known, ask for all of it.
  useEffect(() => {
    if (p && quantity === 1 && p.orderQuantity > 1 && refund === null) setQuantity(p.orderQuantity);
  }, [p?.orderQuantity]); // eslint-disable-line react-hooks/exhaustive-deps

  const buyUsd = p ? Math.round(p.unitBuyUsd * Math.min(quantity, p.orderQuantity) * 100) / 100 : 0;
  const refundUsd = refund === null ? buyUsd : Number(refund) || 0;
  const feeUsd = Number(fee) || 0;
  const figures = refundStockFigures({ buyUsd, sellerRefundUsd: refundUsd, returnFeeUsd: feeUsd });

  const utils = trpc.useUtils();
  const doRefund = trpc.ledger.refundOrder.useMutation({
    onSuccess: (res) => {
      toast.success(L({ ku: `ڕیفەند تۆمار کرا — ${res.orderCode}`, en: `Refund recorded — ${res.orderCode}`, ar: `تم تسجيل الاسترداد — ${res.orderCode}`, zh: `已记录退款 — ${res.orderCode}` }));
      void utils.ledger.stockMarks.invalidate();
      onDone();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={order != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="refund-dialog">
        <DialogHeader>
          <DialogTitle>{L({ ku: "ڕیفەند — کاڵا گەڕایەوە بۆ فرۆشیار", en: "Refund — goods sent back to the seller", ar: "استرداد — أُعيدت البضاعة للبائع", zh: "退款 — 货物退回卖家" })}</DialogTitle>
          <DialogDescription>
            {order?.orderCode}{order?.productName ? ` · ${order.productName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {preview.error && <p className="text-sm text-red-600 dark:text-red-400">{preview.error.message}</p>}
        {p && (
          <div className="space-y-3 text-sm">
            {p.orderQuantity > 1 && (
              <label className="grid gap-1">
                <span>{L({ ku: `چەند دانە؟ (لە ${p.orderQuantity})`, en: `How many pieces? (of ${p.orderQuantity})`, ar: `كم قطعة؟ (من ${p.orderQuantity})`, zh: `几件？（共 ${p.orderQuantity}）` })}</span>
                <Input type="number" min={1} max={p.orderQuantity} value={quantity} dir="ltr"
                  onChange={(e) => { setQuantity(Math.min(p.orderQuantity, Math.max(1, Math.round(Number(e.target.value)) || 1))); setRefund(null); }}
                  data-testid="refund-quantity" />
              </label>
            )}
            <label className="grid gap-1">
              <span>{L({ ku: "فرۆشیار چەندی گەڕاندەوە؟ ($)", en: "How much did the seller refund? ($)", ar: "كم أعاد البائع؟ ($)", zh: "卖家退了多少？（$）" })}</span>
              <Input type="number" min={0} step="0.01" dir="ltr" value={refund ?? buyUsd.toFixed(2)} onChange={(e) => setRefund(e.target.value)} data-testid="refund-seller" />
            </label>
            <label className="grid gap-1">
              <span>{L({ ku: "کرێی گەڕاندنەوە لە چین — لەسەر کڕیار ($)", en: "Return fee inside China — on the customer ($)", ar: "أجرة الإرجاع داخل الصين — على العميل ($)", zh: "中国境内退货运费 — 由客户承担（$）" })}</span>
              <Input type="number" min={0} step="0.01" dir="ltr" placeholder="0" value={fee} onChange={(e) => setFee(e.target.value)} data-testid="refund-fee" />
            </label>
            <label className="grid gap-1">
              <span>{L({ ku: "تێبینی", en: "Note", ar: "ملاحظة", zh: "备注" })}</span>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>

            <div className="space-y-1 rounded-md border bg-muted/40 p-3 tabular-nums" data-testid="refund-preview">
              <p>{L({ ku: `لەسەر ${p.customerCode} لادەچێت:`, en: `Off ${p.customerCode}'s account:`, ar: `يُرفع عن ${p.customerCode}:`, zh: `从 ${p.customerCode} 账户扣除：` })} <b dir="ltr">{fmtUsd(p.plan.takenOffUsd)}</b></p>
              {feeUsd > 0 && <p>{L({ ku: "کرێی گەڕاندنەوە دەچێتە سەری:", en: "Return fee added to it:", ar: "تُضاف أجرة الإرجاع:", zh: "加收退货运费：" })} <b dir="ltr">{fmtUsd(feeUsd)}</b></p>}
              <p className={figures.companyResultUsd < 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}>
                {figures.companyResultUsd < 0
                  ? L({ ku: "زیانی کۆمپانیا:", en: "Company loss:", ar: "خسارة الشركة:", zh: "公司损失：" })
                  : L({ ku: "زیانی کۆمپانیا: نییە", en: "Company loss: none", ar: "خسارة الشركة: لا شيء", zh: "公司损失：无" })}{" "}
                {figures.companyResultUsd < 0 && <b dir="ltr">{fmtUsd(-figures.companyResultUsd)}</b>}
              </p>
              <p className="text-xs text-muted-foreground">
                {L({
                  ku: `تێچوو ${fmtUsd(buyUsd)} − ڕیفەند ${fmtUsd(refundUsd)}. پێشەکیی کڕیار هی خۆیەتی و لای ئێمە دەمێنێتەوە.`,
                  en: `Cost ${fmtUsd(buyUsd)} − refund ${fmtUsd(refundUsd)}. The customer's advance stays theirs, with us.`,
                  ar: `التكلفة ${fmtUsd(buyUsd)} − الاسترداد ${fmtUsd(refundUsd)}. عربون العميل يبقى له لدينا.`,
                  zh: `成本 ${fmtUsd(buyUsd)} − 退款 ${fmtUsd(refundUsd)}。客户预付款仍归客户，存于我方。`,
                })}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} data-mouse-close>{L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</Button>
          <Button
            disabled={!p || doRefund.isPending || refundUsd < 0}
            onClick={() => order && doRefund.mutate({ orderId: order.id, quantity, sellerRefundUsd: refundUsd, returnFeeUsd: feeUsd, note: note.trim() || undefined })}
            data-testid="refund-confirm"
          >
            {L({ ku: "تۆمارکردنی ڕیفەند", en: "Record refund", ar: "تسجيل الاسترداد", zh: "记录退款" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
