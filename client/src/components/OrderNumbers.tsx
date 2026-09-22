import { Link } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { CopyButton } from "@/components/CopyButton";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { parcelSourceTarget, type ParcelOrderRef } from "@shared/parcelSource";

/**
 * A parcel's platform order number(s), beside its tracking — each one copyable.
 *
 * Owner, 2026-09-17: buy-at-cost and full-package parcels are checked with the
 * customer by the order number on the shop's platform (Taobao, 1688…), so
 * wherever staff see a parcel's tracking, its order number sits next to it. A
 * carton can hold several orders; every number is shown. A self order has none,
 * and then this renders nothing.
 *
 * Given the orders themselves (2026-09-21), each number is also the door to
 * its own order — the owner, looking at an alert: "whichever it belongs to,
 * take me there, to the same tracking." The address is decided by the one
 * shared rule, @shared/parcelSource, and never here.
 */
export function OrderNumbers({
  numbers,
  orders,
  className,
  copyClassName,
  bare = false,
}: {
  numbers?: readonly (string | null | undefined)[] | string | null;
  /** When the orders are known, each number opens its own order. */
  orders?: readonly ParcelOrderRef[] | null;
  className?: string;
  /** For a row whose whole surface is one button: lifts the copy buttons above it. */
  copyClassName?: string;
  /** Leave out the "Order no." word — where a label beside it already says so. */
  bare?: boolean;
}) {
  const { language } = useTranslation();
  const list = Array.from(
    new Set((Array.isArray(numbers) ? numbers : [numbers]).map((n) => (n ?? "").trim()).filter(Boolean)),
  );
  if (list.length === 0) return null;

  const label = pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order no.", ar: "رقم الطلب", zh: "订单号" });
  const copy = pickLang(language, { ku: "کۆپی ئۆردەر نەمبەر", en: "Copy order number", ar: "نسخ رقم الطلب", zh: "复制订单号" });

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground", className)}>
      {list.map((number) => {
        const order = (orders ?? []).find((o) => (o?.orderNumber ?? "").trim() === number);
        const href = order ? parcelSourceTarget([order]).href : null;
        return (
          <span key={number} className="inline-flex items-center gap-1" data-order-number={number}>
            {!bare && <span>{label}</span>}
            {href ? (
              <Link href={href} className={cn("font-mono text-sky-700 underline-offset-2 hover:underline dark:text-sky-300", copyClassName)}>
                <bdi dir="ltr">{number}</bdi>
              </Link>
            ) : (
              <bdi dir="ltr" className="font-mono text-foreground">
                {number}
              </bdi>
            )}
            <CopyButton value={number} label={copy} className={copyClassName} />
          </span>
        );
      })}
    </span>
  );
}
