/**
 * What a stranger holding a shared tracking link is allowed to see.
 *
 * A customer sends a parcel to their brother in Sulaymaniyah and wants him to
 * be able to follow it. He has no account and should not need one — but he is
 * also not the customer, and the link may end up in a group chat, forwarded,
 * or screenshotted.
 *
 * So this is the narrowest view in the system: one parcel, where it has got
 * to, and when. Not who it belongs to, not what they paid, not what else they
 * have coming, not the batch's own trackings — those cover every customer in
 * the container and would let one follow another's goods.
 *
 * Written as an allow-list rather than a strip-list. Everywhere else in this
 * codebase removes the sensitive fields from a row and spreads the rest,
 * which is safe until somebody adds a column; this one names what may leave
 * and ignores everything else, so a new column is invisible by default.
 */

export interface ShareableParcelSource {
  trackingNumber?: string | null;
  packageCode?: string | null;
  description?: string | null;
  status?: string | null;
  weightKg?: string | number | null;
  createdAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  /** The batch's public-facing stage and dates, not its internals. */
  batchStatus?: string | null;
  estimatedArrival?: Date | string | null;
  /** The picture of the goods, when there is one. */
  photoUrl?: string | null;
}

export interface ShareableParcel {
  trackingNumber: string | null;
  description: string | null;
  status: string | null;
  batchStatus: string | null;
  weightKg: number | null;
  createdAt: Date | null;
  deliveredAt: Date | null;
  estimatedArrival: Date | null;
  photoUrl: string | null;
}

const asDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Reduce a parcel to the shareable view.
 *
 * The package code is deliberately left out even though it is harmless on its
 * own: it is the identifier staff use, and a public page that prints it
 * invites somebody to try it somewhere it means more.
 */
export function toShareableParcel(source: ShareableParcelSource): ShareableParcel {
  const weight = Number(source.weightKg ?? 0);
  return {
    trackingNumber: source.trackingNumber ?? null,
    description: source.description ?? null,
    status: source.status ?? null,
    batchStatus: source.batchStatus ?? null,
    weightKg: Number.isFinite(weight) && weight > 0 ? weight : null,
    createdAt: asDate(source.createdAt),
    deliveredAt: asDate(source.deliveredAt),
    estimatedArrival: asDate(source.estimatedArrival),
    photoUrl: source.photoUrl ?? null,
  };
}

/** How long a link stays alive without anybody renewing it. */
export const SHARE_LINK_DAYS = 90;

/**
 * Is this link still usable?
 *
 * Revoked beats expired: a customer who turned a link off wants it off now,
 * whatever the date says.
 */
export function shareLinkUsable(
  link: { expiresAt?: Date | string | null; revokedAt?: Date | string | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!link) return false;
  if (asDate(link.revokedAt)) return false;
  const expires = asDate(link.expiresAt);
  // No expiry recorded is treated as expired, not as forever: a row that lost
  // its date should close, not open.
  if (!expires) return false;
  return expires.getTime() > now.getTime();
}
