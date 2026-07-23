import { pickLang } from "@/lib/lang";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Box } from "lucide-react";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// PackageThumb — a package's best available picture, with a small badge saying
// WHERE the picture comes from. Read-only: it only reads queries the portal
// already exposes and joins them on the client by tracking number. No backend
// or business-logic changes.
//
// Fallback chain (most trustworthy first):
//   1. warehouse photo  — staff photographed the real item at our depot (proof)
//   2. product photo    — the image the customer sent for a commission/full order
//   3. your photo       — the image the customer uploaded when pre-declaring
//   4. box icon         — nothing available yet
// ---------------------------------------------------------------------------

type PackageLike = {
  photos?: unknown;
  trackingNumber?: string | null;
  packageCode?: string | null;
};

export type ThumbSource = "warehouse" | "product" | "declared" | null;

interface Resolved {
  url: string | null;
  source: ThumbSource;
}

/** Hook: builds tracking→image lookups once, returns a per-package resolver.
 *  Cheap — both queries are cached and shared across every thumb on the page. */
export function usePackageImages() {
  const { data: fpOrders } = trpc.customerPortal.getMyFullPackageOrders.useQuery(
    {},
    { staleTime: 60_000, retry: false },
  );
  const { data: declared } = trpc.customerPortal.getMyDeclaredPackages.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });

  const productByTracking = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of (fpOrders as any[]) ?? []) {
      const img = o.productImage || (Array.isArray(o.productImages) ? o.productImages[0] : null);
      if (o.trackingNumber && img) m.set(String(o.trackingNumber), img);
    }
    return m;
  }, [fpOrders]);

  const declaredByTracking = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of (declared as any[]) ?? []) {
      const img = Array.isArray(d.productImages) ? d.productImages[0] : null;
      if (d.trackingNumber && img) m.set(String(d.trackingNumber), img);
    }
    return m;
  }, [declared]);

  const resolve = (pkg: PackageLike): Resolved => {
    const photos = Array.isArray(pkg.photos) ? (pkg.photos as string[]) : [];
    if (photos.length > 0) return { url: photos[0], source: "warehouse" };
    const tn = pkg.trackingNumber ? String(pkg.trackingNumber) : "";
    if (tn && productByTracking.has(tn)) return { url: productByTracking.get(tn)!, source: "product" };
    if (tn && declaredByTracking.has(tn)) return { url: declaredByTracking.get(tn)!, source: "declared" };
    return { url: null, source: null };
  };

  return { resolve };
}

const SOURCE_META: Record<
  Exclude<ThumbSource, null>,
  { label: { ku: string; en: string; ar: string; zh: string }; dot: string; text: string }
> = {
  warehouse: {
    label: { ku: "وێنەی کۆگا", en: "Warehouse", ar: "صورة المخزن", zh: "仓库照片" },
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  product: {
    label: { ku: "وێنەی کاڵا", en: "Product", ar: "صورة المنتج", zh: "商品图片" },
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
  },
  declared: {
    label: { ku: "وێنەی تۆ", en: "Your photo", ar: "صورتك", zh: "您的照片" },
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
  },
};

export function PackageThumb({
  resolved,
  language,
  size = 48,
  showBadge = true,
  isDark = false,
  onClick,
  className,
}: {
  resolved: Resolved;
  language: string;
  size?: number;
  showBadge?: boolean;
  isDark?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const pick = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);
  const { url, source } = resolved;

  const box = (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
        isDark ? "bg-slate-700" : "bg-slate-100",
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget.style.display = "none");
          }}
        />
      ) : (
        <Box className={cn(isDark ? "text-slate-400" : "text-slate-500")} style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </div>
  );

  const content = (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      {onClick && url ? (
        <button type="button" onClick={onClick} className="transition active:scale-95">
          {box}
        </button>
      ) : (
        box
      )}
      {showBadge && source && (
        <span className={cn("inline-flex items-center gap-1 text-[9px] font-semibold", SOURCE_META[source].text)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", SOURCE_META[source].dot)} />
          {pick(SOURCE_META[source].label)}
        </span>
      )}
    </div>
  );

  return content;
}
