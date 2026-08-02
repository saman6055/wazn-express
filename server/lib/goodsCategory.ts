/**
 * Where a package's goods category comes from.
 *
 * Three people could know what is in the box, and they are not equally well
 * placed to say:
 *
 *  1. The warehouse, if a member of staff picked one at the scanner. An
 *     explicit choice always wins — someone looked at the box and decided.
 *  2. The customer, who can pick a category when declaring the tracking
 *     number in the portal before it arrives. They bought it, so they know
 *     better than whoever is holding it.
 *  3. Nobody, in which case the package is registered without one and the
 *     gap shows up in the registrations list to be filled later.
 *
 * The customer's declaration used to be thrown away at scan time: they had
 * told us what was coming and the scan ignored it.
 */
export function resolveGoodsCategory(sources: {
  /** Chosen by staff at the scanner. */
  scanned?: number | null;
  /** Chosen by the customer when they declared the tracking number. */
  declared?: number | null;
}): number | undefined {
  return sources.scanned ?? sources.declared ?? undefined;
}

/**
 * Whether the scanner has to ask. It only does when nobody else has said
 * anything — for a parcel the customer never declared, the person holding the
 * box is the only one who will ever know what is in it.
 */
export function mustAskForCategory(declaredCategoryId?: number | null): boolean {
  return !declaredCategoryId;
}
