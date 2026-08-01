/**
 * Which China-depot items a customer should see for the filters they picked.
 *
 * Pulled out of the page because the rule has now been wrong twice: first the
 * list ignored the route entirely and showed air-standard parcels under sea,
 * then it over-corrected and hid the whole section the moment any route was
 * chosen. Both times the page ended up contradicting itself.
 */

export interface ChinaDepotItem {
  code: string;
  /** Chosen at quick-register. Null only for older rows that predate it. */
  shippingType?: string | null;
}

export interface ChinaDepotFilters {
  /** The stage pill: "" means none picked. */
  stage?: string;
  /** The route row above it: "" means none picked. */
  shippingType?: string;
  search?: string;
}

/**
 * An item belongs under the chosen route when it matches — or when it has no
 * route recorded at all. Hiding an unrouted parcel from every route would make
 * it unreachable, which is worse than showing it under one too many.
 */
export function matchesRoute(itemType: string | null | undefined, chosen: string | undefined): boolean {
  if (!chosen) return true;
  if (!itemType) return true;
  return itemType === chosen;
}

export function filterChinaDepot<T extends ChinaDepotItem>(
  items: T[],
  filters: ChinaDepotFilters,
): T[] {
  // The list only belongs under the China stage, or under no stage at all.
  if (filters.stage && filters.stage !== "in_china") return [];

  const query = (filters.search ?? "").trim().toLowerCase();

  return items.filter(item => {
    if (!matchesRoute(item.shippingType, filters.shippingType)) return false;
    if (query && !item.code.toLowerCase().includes(query)) return false;
    return true;
  });
}
