/**
 * Plan v3, Phase 4 — safe delete dialog with reason + financial-impact preview.
 *
 * This dialog enforces the contract the backend (Phase 3) requires:
 *   - `reason` (min 3 chars) — embedded into the ledger reversal description
 *     and the audit log. Without it, the server throws BAD_REQUEST.
 *   - `refundAdvance` — whether to reverse the advance payment (defaults on).
 *   - `expectedVersion` — OCC check so we reject deletes against a stale copy.
 *
 * UX guarantees:
 *   - Shows the customer-facing financial impact BEFORE the admin confirms:
 *     how many USD will be reversed from the customer's balance, broken down
 *     into the order charge + advance payment refund.
 *   - Disables the confirm button until reason is ≥ 3 chars.
 *   - Shows server errors inline (e.g. CONFLICT → user reloads and retries).
 *   - Bilingual Kurdish / English — matches the rest of the app's mixed-lang
 *     admin screens.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

export interface SafeDeleteOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: number;
    orderCode: string;
    productName: string;
    orderType: string;
    quantity?: number | null;
    sellingPriceUsd?: string | null;
    itemPriceUsd?: string | null;
    commissionFeeUsd?: string | null;
    advancePaidUsd?: string | null;
    chargeTransactionId?: number | null;
    version?: number | null;
  };
  onDeleted?: () => void;
}

/**
 * Compute the same chargeable amount the server will reverse. Mirrors
 * server/db/fullPackage.db.ts `computeOrderChargeAmount`. Kept in sync
 * manually; if the formula changes there, change it here too. A mismatch
 * is cosmetic only — the server is still the source of truth, the preview
 * would just look slightly off.
 */
function previewChargeAmount(order: SafeDeleteOrderDialogProps["order"]): number {
  const qty = order.quantity ?? 1;
  if (order.orderType === "full_package" || order.orderType === "purchase_request") {
    const selling = parseFloat(String(order.sellingPriceUsd ?? "0")) || 0;
    return selling * qty;
  }
  if (order.orderType === "commission") {
    const item = parseFloat(String(order.itemPriceUsd ?? "0")) || 0;
    const commission = parseFloat(String(order.commissionFeeUsd ?? "0")) || 0;
    return item * qty + commission;
  }
  return 0;
}

export default function SafeDeleteOrderDialog({
  open,
  onOpenChange,
  order,
  onDeleted,
}: SafeDeleteOrderDialogProps) {
  const [reason, setReason] = useState("");
  const [refundAdvance, setRefundAdvance] = useState(true);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.fullPackage.delete.useMutation({
    onSuccess: (res) => {
      const parts: string[] = ["ئۆردەر سڕایەوە | Order deleted"];
      if ((res as any).reversedChargeUsd > 0) {
        parts.push(`گەڕاندنەوەی نرخ: $${(res as any).reversedChargeUsd.toFixed(2)}`);
      }
      if ((res as any).reversedAdvanceUsd > 0) {
        parts.push(`گەڕاندنەوەی پێشەکی: $${(res as any).reversedAdvanceUsd.toFixed(2)}`);
      }
      toast.success(parts.join(" · "));
      utils.fullPackage.list.invalidate();
      setReason("");
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (error) => {
      toast.error(error.message || "هەڵە | Delete failed");
    },
  });

  const advance = parseFloat(String(order.advancePaidUsd ?? "0")) || 0;
  const previewCharge = order.chargeTransactionId ? previewChargeAmount(order) : 0;
  const totalReversal = previewCharge + (refundAdvance ? advance : 0);
  const hasFinancialImpact = previewCharge > 0 || (refundAdvance && advance > 0);

  const reasonValid = reason.trim().length >= 3;
  const isBusy = deleteMutation.isPending;

  const handleConfirm = () => {
    if (!reasonValid) return;
    deleteMutation.mutate({
      id: order.id,
      reason: reason.trim(),
      refundAdvance,
      expectedVersion: order.version ?? undefined,
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-right">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            سڕینەوەی ئۆردەر | Delete Order
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right space-y-2">
            <div>
              ئۆردەر:{" "}
              <span className="font-mono font-bold text-red-600">{order.orderCode}</span>
              {" — "}
              <span className="font-semibold">{order.productName}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              ئەم کارە هەوڵدانەوەیی نییە. هەموو پارەکانی پەیوەست بە دەفتەری هەژماری کڕیار
              دەگەڕێنرێتەوە بۆ پاراستنی دروستی ژمارەکان.
              <br />
              This action is not recoverable. All linked customer-ledger money will
              be reversed to keep the balance accurate.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Financial impact preview */}
        {hasFinancialImpact && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 space-y-2">
            <div className="font-bold text-amber-900 text-sm">
              کاریگەری دارایی | Financial Impact Preview
            </div>
            {previewCharge > 0 && (
              <div className="flex justify-between text-sm">
                <span>گەڕاندنەوەی نرخی ئۆردەر | Order charge reversal:</span>
                <span className="font-mono font-bold text-green-700">
                  −${previewCharge.toFixed(2)}
                </span>
              </div>
            )}
            {advance > 0 && (
              <div className="flex justify-between text-sm">
                <span>گەڕاندنەوەی پارەی پێشەکی | Advance refund:</span>
                <span className="font-mono font-bold text-red-700">
                  {refundAdvance ? `+$${advance.toFixed(2)}` : "—"}
                </span>
              </div>
            )}
            <div className="border-t border-amber-200 pt-2 flex justify-between">
              <span className="font-bold text-amber-900">
                کۆی گۆڕانکاری لە باڵانس | Net ledger change:
              </span>
              <span className="font-mono font-bold text-amber-900">
                {totalReversal >= 0 ? "+" : ""}
                ${Math.abs(totalReversal).toFixed(2)}
              </span>
            </div>
            {advance > 0 && (
              <label className="flex items-center gap-2 text-xs text-amber-900 pt-1 cursor-pointer">
                <Checkbox
                  checked={refundAdvance}
                  onCheckedChange={(v) => setRefundAdvance(v === true)}
                />
                <span>
                  گەڕاندنەوەی پارەی پێشەکی بۆ کڕیار | Refund advance payment to customer
                </span>
              </label>
            )}
          </div>
        )}

        {!order.chargeTransactionId && (
          <div className="text-xs text-muted-foreground border-l-2 border-muted pl-2 py-1">
            ℹ ئەم ئۆردەرە هێشتا نرخی بەسەر کڕیاردا داننراوە، بۆیە تەنها ئۆردەرەکە
            دەسڕێتەوە (دەفتەری هەژمار ناگۆڕێ).
            <br />
            This order has not been charged yet, so only the record will be removed
            (the customer ledger stays untouched).
          </div>
        )}

        {/* Reason input */}
        <div className="space-y-2">
          <Label htmlFor="delete-reason" className="text-right block">
            هۆکاری سڕینەوە | Reason for deletion <span className="text-red-600">*</span>
          </Label>
          <Textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="بۆ نموونە: کڕیار ئۆردەرەکەی هەڵوەشاندەوە | e.g. Customer cancelled the order"
            rows={3}
            disabled={isBusy}
            dir="auto"
          />
          <div className="text-xs text-muted-foreground text-right">
            {reason.trim().length < 3
              ? `بەلایەنی کەم ٣ پیت | At least 3 characters (${reason.trim().length}/3)`
              : `${reason.trim().length} پیت | chars`}
          </div>
        </div>

        <AlertDialogFooter className="flex gap-2">
          <AlertDialogCancel disabled={isBusy}>پاشگەزبوونەوە | Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reasonValid || isBusy}
            className="bg-red-600 hover:bg-red-700"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 ms-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 ms-2" />
            )}
            سڕینەوە بە کاریگەری دارایی | Delete with Financial Reversal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
