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
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
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
 * server/db/fullPackage.db.ts `computeOrderChargeAmount` /
 * `commissionGoodsTotal`. Kept in sync manually; if the formula changes
 * there, change it here too. A mismatch is cosmetic only — the server is
 * still the source of truth, the preview would just look slightly off.
 */
function previewChargeAmount(order: SafeDeleteOrderDialogProps["order"]): number {
  const qty = order.quantity ?? 1;
  if (order.orderType === "full_package" || order.orderType === "purchase_request") {
    const selling = parseFloat(String(order.sellingPriceUsd ?? "0")) || 0;
    return selling * qty;
  }
  if (order.orderType === "commission") {
    // Item price and commission are both PER-UNIT.
    const item = parseFloat(String(order.itemPriceUsd ?? "0")) || 0;
    const commission = parseFloat(String(order.commissionFeeUsd ?? "0")) || 0;
    return (item + commission) * qty;
  }
  return 0;
}

export default function SafeDeleteOrderDialog({
  open,
  onOpenChange,
  order,
  onDeleted,
}: SafeDeleteOrderDialogProps) {
  const { language } = useTranslation();
  const [reason, setReason] = useState("");
  const [refundAdvance, setRefundAdvance] = useState(true);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.fullPackage.delete.useMutation({
    onSuccess: (res) => {
      const parts: string[] = [
        pickLang(language, {
          ku: "ئۆردەر سڕایەوە",
          en: "Order deleted",
          ar: "تم حذف الطلب",
          zh: "订单已删除",
        }),
      ];
      if ((res as any).reversedChargeUsd > 0) {
        parts.push(
          `${pickLang(language, {
            ku: "گەڕاندنەوەی نرخ",
            en: "Charge reversal",
            ar: "عكس الرسوم",
            zh: "费用退回",
          })}: $${(res as any).reversedChargeUsd.toFixed(2)}`
        );
      }
      if ((res as any).reversedAdvanceUsd > 0) {
        parts.push(
          `${pickLang(language, {
            ku: "گەڕاندنەوەی پێشەکی",
            en: "Advance refund",
            ar: "استرداد الدفعة المقدمة",
            zh: "预付款退回",
          })}: $${(res as any).reversedAdvanceUsd.toFixed(2)}`
        );
      }
      toast.success(parts.join(" · "));
      utils.fullPackage.list.invalidate();
      utils.fullPackage.getCustomerPendingOrders.invalidate();
      setReason("");
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (error) => {
      // Always log the full error so the actual root cause lands in the
      // browser DevTools console — critical when the toast UI is hidden
      // or clipped (we've seen Sonner render empty in RTL layouts).
      // eslint-disable-next-line no-console
      console.error("[SafeDeleteOrderDialog] delete mutation failed:", {
        message: error.message,
        code: error.data?.code,
        httpStatus: error.data?.httpStatus,
        path: error.data?.path,
        data: error.data,
        shape: error.shape,
      });

      // Distinct toast for OCC conflicts so the operator knows to reload
      // — "just retry" would silently clobber a concurrent edit.
      if (error.data?.code === "CONFLICT") {
        toast.error(
          pickLang(language, {
            ku: "ئۆردەرەکە لەلایەن کەسێکی دیکەوە گۆڕدراوە",
            en: "Order changed elsewhere",
            ar: "تم تغيير الطلب من مكان آخر",
            zh: "订单已在其他地方被更改",
          }),
          {
            description: pickLang(language, {
              ku: "تکایە پەڕەکە نوێ بکەرەوە و هەوڵ بدەرەوە.",
              en: "Please reload the page and try again.",
              ar: "يرجى إعادة تحميل الصفحة والمحاولة مرة أخرى.",
              zh: "请刷新页面后重试。",
            }),
            duration: 10000,
          }
        );
        return;
      }
      // Non-empty fallback — zod/validation errors sometimes surface with
      // empty .message, and Sonner renders an icon-only empty toast otherwise.
      const rawMsg =
        typeof error.message === "string" ? error.message.trim() : "";
      const code = error.data?.code ?? "UNKNOWN";
      const title =
        rawMsg ||
        pickLang(language, {
          ku: "هەڵە لە سڕینەوەی ئۆردەر",
          en: "Delete failed",
          ar: "فشل الحذف",
          zh: "删除失败",
        });
      toast.error(title, {
        description: `${pickLang(language, {
          ku: "کۆدی هەڵە",
          en: "Error code",
          ar: "رمز الخطأ",
          zh: "错误代码",
        })}: ${code}`,
        duration: 10000,
      });
    },
  });

  const advance = parseFloat(String(order.advancePaidUsd ?? "0")) || 0;
  const previewCharge = order.chargeTransactionId ? previewChargeAmount(order) : 0;
  const totalReversal = previewCharge + (refundAdvance ? advance : 0);
  const hasFinancialImpact = previewCharge > 0 || (refundAdvance && advance > 0);

  // Pending orders (not charged, no advance) have no financial impact —
  // the reason field becomes optional and the dialog is a simple confirm.
  const isPendingOrder = !order.chargeTransactionId && advance === 0;
  const reasonValid = isPendingOrder ? true : reason.trim().length >= 3;
  const isBusy = deleteMutation.isPending;

  const handleConfirm = () => {
    if (!reasonValid) return;
    const effectiveReason = isPendingOrder && reason.trim().length < 3
      ? "Pending order — no accounting impact"
      : reason.trim();
    deleteMutation.mutate({
      id: order.id,
      reason: effectiveReason,
      refundAdvance,
      expectedVersion: order.version ?? undefined,
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-right">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
            {pickLang(language, {
              ku: "سڕینەوەی ئۆردەر",
              en: "Delete Order",
              ar: "حذف الطلب",
              zh: "删除订单",
            })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right space-y-2">
            <div>
              {pickLang(language, { ku: "ئۆردەر", en: "Order", ar: "الطلب", zh: "订单" })}:{" "}
              <span className="font-mono font-bold text-red-600 dark:text-red-300">{order.orderCode}</span>
              {" — "}
              <span className="font-semibold">{order.productName}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {pickLang(language, {
                ku: "ئەم کارە هەوڵدانەوەیی نییە. هەموو پارەکانی پەیوەست بە دەفتەری هەژماری کڕیار دەگەڕێنرێتەوە بۆ پاراستنی دروستی ژمارەکان.",
                en: "This action is not recoverable. All linked customer-ledger money will be reversed to keep the balance accurate.",
                ar: "هذا الإجراء لا يمكن التراجع عنه. سيتم عكس جميع المبالغ المرتبطة بدفتر حساب العميل للحفاظ على دقة الرصيد.",
                zh: "此操作不可恢复。所有关联到客户账本的款项将被冲销，以确保余额准确。",
              })}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Financial impact preview */}
        {hasFinancialImpact && (
          <div className="rounded-lg border-2 border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
            <div className="font-bold text-amber-900 dark:text-amber-200 text-sm">
              {pickLang(language, {
                ku: "کاریگەری دارایی",
                en: "Financial Impact Preview",
                ar: "معاينة الأثر المالي",
                zh: "财务影响预览",
              })}
            </div>
            {previewCharge > 0 && (
              <div className="flex justify-between text-sm">
                <span>
                  {pickLang(language, {
                    ku: "گەڕاندنەوەی نرخی ئۆردەر",
                    en: "Order charge reversal",
                    ar: "عكس رسوم الطلب",
                    zh: "订单费用冲销",
                  })}:
                </span>
                <span className="font-mono font-bold text-green-700 dark:text-green-300">
                  −${previewCharge.toFixed(2)}
                </span>
              </div>
            )}
            {advance > 0 && (
              <div className="flex justify-between text-sm">
                <span>
                  {pickLang(language, {
                    ku: "گەڕاندنەوەی پارەی پێشەکی",
                    en: "Advance refund",
                    ar: "استرداد الدفعة المقدمة",
                    zh: "预付款退回",
                  })}:
                </span>
                <span className="font-mono font-bold text-red-700 dark:text-red-300">
                  {refundAdvance ? `+$${advance.toFixed(2)}` : "—"}
                </span>
              </div>
            )}
            <div className="border-t border-amber-200 dark:border-amber-800/60 pt-2 flex justify-between">
              <span className="font-bold text-amber-900 dark:text-amber-200">
                {pickLang(language, {
                  ku: "کۆی گۆڕانکاری لە باڵانس",
                  en: "Net ledger change",
                  ar: "صافي تغيّر دفتر الحساب",
                  zh: "账本净变动",
                })}:
              </span>
              <span className="font-mono font-bold text-amber-900 dark:text-amber-200">
                {totalReversal >= 0 ? "+" : ""}
                ${Math.abs(totalReversal).toFixed(2)}
              </span>
            </div>
            {advance > 0 && (
              <label className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 pt-1 cursor-pointer">
                <Checkbox
                  checked={refundAdvance}
                  onCheckedChange={(v) => setRefundAdvance(v === true)}
                />
                <span>
                  {pickLang(language, {
                    ku: "گەڕاندنەوەی پارەی پێشەکی بۆ کڕیار",
                    en: "Refund advance payment to customer",
                    ar: "استرداد الدفعة المقدمة إلى العميل",
                    zh: "向客户退还预付款",
                  })}
                </span>
              </label>
            )}
          </div>
        )}

        {!order.chargeTransactionId && (
          <div className="text-xs text-muted-foreground border-l-2 border-muted pl-2 py-1">
            ℹ{" "}
            {pickLang(language, {
              ku: "ئەم ئۆردەرە هێشتا نرخی بەسەر کڕیاردا داننراوە، بۆیە تەنها ئۆردەرەکە دەسڕێتەوە (دەفتەری هەژمار ناگۆڕێ).",
              en: "This order has not been charged yet, so only the record will be removed (the customer ledger stays untouched).",
              ar: "لم يتم احتساب رسوم هذا الطلب بعد، لذا سيتم حذف السجل فقط (يبقى دفتر حساب العميل دون تغيير).",
              zh: "此订单尚未计费，因此仅删除记录（客户账本保持不变）。",
            })}
          </div>
        )}

        {/* Reason input — required only when the order has financial impact */}
        {!isPendingOrder && (
          <div className="space-y-2">
            <Label htmlFor="delete-reason" className="text-right block">
              {pickLang(language, {
                ku: "هۆکاری سڕینەوە",
                en: "Reason for deletion",
                ar: "سبب الحذف",
                zh: "删除原因",
              })}{" "}
              <span className="text-red-600 dark:text-red-300">*</span>
            </Label>
            <Textarea
              id="delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={pickLang(language, {
                ku: "بۆ نموونە: کڕیار ئۆردەرەکەی هەڵوەشاندەوە",
                en: "e.g. Customer cancelled the order",
                ar: "مثال: ألغى العميل الطلب",
                zh: "例如：客户取消了订单",
              })}
              rows={3}
              disabled={isBusy}
              dir="auto"
            />
            <div className="text-xs text-muted-foreground text-right">
              {reason.trim().length < 3
                ? `${pickLang(language, {
                    ku: "بەلایەنی کەم ٣ پیت",
                    en: "At least 3 characters",
                    ar: "٣ أحرف على الأقل",
                    zh: "至少 3 个字符",
                  })} (${reason.trim().length}/3)`
                : `${reason.trim().length} ${pickLang(language, {
                    ku: "پیت",
                    en: "chars",
                    ar: "حرف",
                    zh: "个字符",
                  })}`}
            </div>
          </div>
        )}

        <AlertDialogFooter className="flex gap-2">
          <AlertDialogCancel disabled={isBusy}>
            {pickLang(language, {
              ku: "پاشگەزبوونەوە",
              en: "Cancel",
              ar: "إلغاء",
              zh: "取消",
            })}
          </AlertDialogCancel>
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
            {isPendingOrder
              ? pickLang(language, {
                  ku: "سڕینەوە",
                  en: "Delete",
                  ar: "حذف",
                  zh: "删除",
                })
              : pickLang(language, {
                  ku: "سڕینەوە بە کاریگەری دارایی",
                  en: "Delete with Financial Reversal",
                  ar: "حذف مع عكس مالي",
                  zh: "删除并冲销财务",
                })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
