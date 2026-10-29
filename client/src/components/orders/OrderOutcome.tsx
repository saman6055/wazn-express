import { PackageX, Undo2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
import { trpc } from "@/lib/trpc";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

/**
 * The two ends an order can have besides arriving (owner, 2026-10-26), on
 * the order lists themselves: «گەڕاوە» - the customer refused it and the
 * goods are with us (the refusal on the company-stock page) - and «ڕیفەند» -
 * the goods went back to the seller (RefundOrderDialog). Both move the money;
 * naming the status alone no longer can (fullPackage.updateStatus refuses).
 */

/** Statuses the menu may still set by name. The two that need money are not among them. */
export const STATUS_NEEDS_DOOR = ["refunded", "returned"] as const;
export const withoutMoneyStatuses = <T extends { value: string }>(options: T[]): T[] =>
  options.filter((o) => !(STATUS_NEEDS_DOOR as readonly string[]).includes(o.value));

const ENDED = ["cancelled", "refunded", "returned", "rejected"];

export function OrderOutcomeMenuItems({
  order,
  language,
  isMainAdmin,
  onReturned,
  onRefund,
}: {
  order: { status: string };
  language: string;
  isMainAdmin: boolean;
  onReturned: () => void;
  onRefund: () => void;
}) {
  if (!isMainAdmin || ENDED.includes(order.status)) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onReturned} data-testid="order-returned">
        <PackageX className="me-2 h-4 w-4 text-red-600 dark:text-red-400" />
        {pickLang(language, { ku: "گەڕاوە… (کڕیار ڕەتی کردەوە)", en: "Returned… (customer refused)", ar: "مرتجع… (رفضه العميل)", zh: "退回…（客户拒收）" })}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onRefund} data-testid="order-refund">
        <Undo2 className="me-2 h-4 w-4 text-sky-600 dark:text-sky-400" />
        {pickLang(language, { ku: "ڕیفەند… (بۆ فرۆشیار گەڕایەوە)", en: "Refund… (back to the seller)", ar: "استرداد… (أُعيد للبائع)", zh: "退款…（退回卖家）" })}
      </DropdownMenuItem>
    </>
  );
}

/**
 * An old order ticked "paid before" whose money never reached the books, or
 * was handed back (owner, 2026-10-28): the main admin clears the tick and the
 * goods are charged the one way (ledger.chargeOrderMarkedPrepaid). Shown only
 * on an order carrying the tick; the server refuses goods already on the
 * account and an order in a receipted box.
 */
export function PrepaidFixMenuItem({ order, language, isMainAdmin }: {
  order: { id: number; orderCode: string; isPrepaid?: boolean | null; status: string };
  language: string;
  isMainAdmin: boolean;
}) {
  const utils = trpc.useUtils();
  const fix = trpc.ledger.chargeOrderMarkedPrepaid.useMutation({
    onSuccess: (r) => {
      toast.success(`نرخی ${r.orderCode} نووسرا: $${r.amountUsd.toFixed(2)}`);
      void utils.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  if (!isMainAdmin || !order.isPrepaid || ENDED.includes(order.status)) return null;
  return (
    <DropdownMenuItem
      data-testid="order-prepaid-fix"
      disabled={fix.isPending}
      onClick={() => {
        const reason = window.prompt(
          pickLang(language, {
            ku: `${order.orderCode}: پێشەکییەکەی بە هەڵە نیشانە کراوە؟ نرخی کاڵاکە دەچێتە سەر حیسابی کڕیار. هۆکار بنووسە:`,
            en: `${order.orderCode}: wrongly marked prepaid? Its goods will be charged to the customer. Write the reason:`,
            ar: `${order.orderCode}: هل عُلّم كمدفوع مسبقاً بالخطأ؟ سيُحمَّل سعر البضاعة على العميل. اكتب السبب:`,
            zh: `${order.orderCode}：误标为已预付？货款将计入客户账户。请写原因：`,
          }),
        );
        if (!reason || reason.trim().length < 5) return;
        fix.mutate({ orderId: order.id, reason: reason.trim() });
      }}
    >
      <Receipt className="me-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
      {pickLang(language, { ku: "پێشەکی بە هەڵە نیشانە کراوە — نرخەکە بنووسە", en: "Wrongly marked prepaid — charge the goods", ar: "عُلّم مدفوعاً بالخطأ — سجّل السعر", zh: "误标已预付 — 记入货款" })}
    </DropdownMenuItem>
  );
}

/** Which of the listed orders were refused or refunded. */
export function useOrderStockMarks(orderIds: number[]) {
  const q = trpc.ledger.stockMarks.useQuery({ orderIds: orderIds.slice(0, 500) }, { enabled: orderIds.length > 0 });
  const marks = new Map<number, { reason: string; quantity: number }>();
  for (const m of q.data ?? []) if (m.orderId) marks.set(m.orderId, { reason: m.reason, quantity: m.quantity });
  return marks;
}

export function OrderStockMark({ mark, language }: { mark: { reason: string; quantity: number } | undefined; language: string }) {
  if (!mark) return null;
  const refund = mark.reason === "refunded";
  return (
    <span
      className={`ms-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${refund
        ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
        : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"}`}
      data-testid="order-stock-mark"
    >
      {refund
        ? pickLang(language, { ku: "ڕیفەند", en: "Refunded", ar: "مسترد", zh: "已退款" })
        : pickLang(language, { ku: "گەڕاوە", en: "Returned", ar: "مرتجع", zh: "已退回" })}
      {mark.quantity > 1 ? ` ×${mark.quantity}` : ""}
    </span>
  );
}
