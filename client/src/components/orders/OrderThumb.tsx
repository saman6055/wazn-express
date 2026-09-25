import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ZoomImage } from "@/components/ZoomImage";
import { cn } from "@/lib/utils";

/**
 * The little square at the front of an order row.
 *
 * The owner, 2026-09-25: "the buy-at-cost table loads very heavily."
 *
 * It drew this square from the order's own `productImage` — a base64 photo,
 * up to a megabyte, shipped with every row of the list so that forty pixels
 * could be painted. Three hundred rows was hundreds of megabytes before the
 * table appeared.
 *
 * Now the list carries `hasImage` and nothing else, and the thumbnails come
 * in one extra request for the whole page: 96px JPEGs, a few kilobytes each,
 * shrunk once on the server and remembered there
 * (services/orderThumbs.service.ts). Clicking one still opens the full
 * picture, which is the only time the big file is worth moving.
 */

const ThumbContext = createContext<Record<number, string> | null>(null);

/**
 * Asks for the thumbnails of the rows about to be drawn.
 *
 * Wrap the table in it. One request for the page, not one per row, and it
 * asks for nothing at all when no row in view has a picture.
 */
export function OrderThumbs({
  orders,
  children,
}: {
  orders: Array<{ id: number; hasImage?: boolean | null }>;
  children: ReactNode;
}) {
  const ids = useMemo(
    () => orders.filter((o) => o.hasImage).map((o) => o.id).slice(0, 300),
    [orders],
  );
  const { data } = trpc.fullPackage.thumbs.useQuery(
    { ids },
    {
      enabled: ids.length > 0,
      // The picture on an order does not change while a list is being read,
      // and the server holds its own copy anyway.
      staleTime: 10 * 60_000,
      gcTime: 30 * 60_000,
    },
  );
  return <ThumbContext.Provider value={data ?? null}>{children}</ThumbContext.Provider>;
}

export function OrderThumb({
  order,
  className,
  tone = "emerald",
}: {
  order: { id: number; productName?: string | null; hasImage?: boolean | null };
  className?: string;
  tone?: "emerald" | "amber";
}) {
  const thumbs = useContext(ThumbContext);
  const src = order.hasImage ? thumbs?.[order.id] : undefined;

  if (src) {
    return <ZoomImage src={src} alt={order.productName ?? ""} className={cn("w-10 h-10", className)} />;
  }
  return (
    <div
      className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center",
        tone === "amber"
          ? "bg-amber-100 dark:bg-amber-950/40"
          : "bg-emerald-100 dark:bg-emerald-950/40",
        className,
      )}
      // A row that has a picture but whose thumbnail has not landed yet
      // shows the same placeholder rather than a hole in the table.
      aria-hidden="true"
    >
      <Package
        className={cn(
          "h-5 w-5",
          tone === "amber" ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300",
        )}
      />
    </div>
  );
}
