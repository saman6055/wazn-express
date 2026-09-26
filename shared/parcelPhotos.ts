/**
 * Which picture of a thing the customer sees first.
 *
 * The owner, 2026-09-26: "when we enter a کڕین بە تێچوو or a پاکێجی تەواو we
 * attach photos. In the portal the first, visible picture must be the one
 * attached when the order was entered — not the one from quick register. The
 * first is the order's own photo, the next is the quick-register photo, for
 * the same item."
 *
 * He is right, and the reason is worth writing down: the order photo is the
 * thing the customer chose. It is the picture from the shop, the one they
 * recognise. The warehouse shot is the same goods in a sack under a strip
 * light, taken to prove the parcel arrived — useful, and not what anybody
 * wants to see first in a list of their own orders.
 *
 * Both are kept, in that order, so nothing is hidden: the customer opens the
 * thumbnail and swipes from what they bought to what turned up.
 *
 * Stated once here because the portal shows these pictures on several screens
 * and in three skins, and a fallback chain copied into each is a chain that
 * ends up in three different orders (parcelPhotos.test.ts).
 */

/** Where a picture came from — the portal prints this as a small badge. */
export type PhotoSource = "product" | "warehouse" | "declared";

export interface PhotoSets {
  /** Attached when the commission / full-package order was entered. */
  order?: unknown;
  /** Taken at the depot — quick register, arrival check. */
  warehouse?: unknown;
  /** Uploaded by the customer when they pre-declared the tracking. */
  declared?: unknown;
}

/**
 * Flatten anything a photo column might hold into a list of distinct URLs.
 *
 * The columns arrive in every shape: a JSON array of warehouse shots, a
 * single `productImage`, a `productImages` array, and often two of those at
 * once for the same parcel. The same URL reaching here twice counts once, so
 * a thumbnail that says "3" means three different pictures.
 */
export function photoList(...sources: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const take = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(take);
      return;
    }
    if (typeof value !== "string") return;
    const url = value.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };
  sources.forEach(take);
  return out;
}

/**
 * Every picture of one thing, in the order the customer should meet them:
 * what they ordered, then what we photographed, then what they sent us.
 *
 * A parcel with no order behind it simply starts at the warehouse shot, which
 * is what it always did.
 */
export function customerPhotos(sets: PhotoSets): string[] {
  return photoList(sets.order, sets.warehouse, sets.declared);
}

/** Which set the first picture came from, for the badge beside it. */
export function firstPhotoSource(sets: PhotoSets): PhotoSource | null {
  const first = customerPhotos(sets)[0];
  if (!first) return null;
  if (photoList(sets.order).includes(first)) return "product";
  if (photoList(sets.warehouse).includes(first)) return "warehouse";
  return "declared";
}
