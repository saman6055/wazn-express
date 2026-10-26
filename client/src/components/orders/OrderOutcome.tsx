import { PackageX, Undo2 } from "lucide-react";
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
