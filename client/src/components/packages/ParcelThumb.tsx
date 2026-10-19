import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ZoomImage } from "@/components/ZoomImage";
import { cn } from "@/lib/utils";

/**
 * The picture at the front of a parcel row.
 *
 * The owner, 2026-10-19: «لە هەموو پاکەتەکان وێنەش نیشان بدات». The list
 * carries no pictures (they made it heavy, 2026-09-25); the squares come in
 * one request for the page - 96px, made once on the server - the order's
 * photo first, then the depot's (shared/parcelPhotos). The same way the
 * orders list does it (components/orders/OrderThumb).
 */

const ThumbContext = createContext<Record<number, string> | null>(null);

/** Wrap the list in it: one request for the rows on screen. */
export function ParcelThumbs({ ids, children }: { ids: number[]; children: ReactNode }) {
  const page = useMemo(() => ids.slice(0, 300), [ids]);
  const { data } = trpc.packages.thumbs.useQuery(
    { ids: page },
    { enabled: page.length > 0, staleTime: 10 * 60_000, gcTime: 30 * 60_000 },
  );
  return <ThumbContext.Provider value={data ?? null}>{children}</ThumbContext.Provider>;
}

export function ParcelThumb({ id, alt, className }: { id: number; alt?: string; className?: string }) {
  const src = useContext(ThumbContext)?.[id];
  if (src) {
    return <ZoomImage src={src} alt={alt ?? ""} className={cn("h-10 w-10 shrink-0", className)} />;
  }
  return (
    <div
      className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted", className)}
      aria-hidden="true"
      data-testid="parcel-thumb-empty"
    >
      <Package className="h-5 w-5 text-muted-foreground/60" />
    </div>
  );
}
