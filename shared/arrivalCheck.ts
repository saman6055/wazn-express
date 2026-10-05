/**
 * What an arrival check found, kept so it can be gone back to.
 *
 * The owner, 2026-10-05: «کاتێ پشکنینی گەیاندن ئەکەی، ئەو باچانەی پشکنینیان بۆ
 * کراوە، وردەکاریی هاتوو و نەهاتووەکانی لە شوێنێ بمێنێ، بتوانی دووبارە بچیتەوە
 * سەری». Every scan at the bench has always been written down — the work was
 * never lost. What was lost was the way back to it: the screen lists only
 * batches still on the road, so the day a batch was marked as arrived, the
 * record of which of its parcels did and did not turn up went out of reach,
 * on the very day somebody would start asking where parcel number 61 is.
 *
 * Nothing new is stored. A check is the batch's manifest set against its
 * `received_local` scans; this is the setting-against, in one place, so the
 * list of checked batches and the detail of one cannot count differently.
 */

export interface ManifestParcel {
  id: number;
  trackingNumber?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  orderCode?: string | null;
  orderNumbers?: string[] | null;
  photo?: string | null;
}

export interface ArrivalScan {
  packageId?: number | null;
  scannedAt?: Date | string | null;
  scannedByName?: string | null;
}

export interface ArrivedParcel<T extends ManifestParcel> {
  parcel: T;
  /** When it was checked in at the bench. */
  checkedAt: Date | null;
  checkedBy: string | null;
}

export interface ArrivalSplit<T extends ManifestParcel> {
  arrived: ArrivedParcel<T>[];
  missing: T[];
}

/**
 * The manifest, split by whether each parcel was checked in.
 *
 * A parcel counts once, at its first scan — a second scan of the same parcel
 * is the same arrival looked at twice. Arrived parcels come newest first,
 * the order they were handled in; the missing keep the manifest's order.
 */
export function splitArrival<T extends ManifestParcel>(
  manifest: readonly T[],
  scans: readonly ArrivalScan[],
): ArrivalSplit<T> {
  const first = new Map<number, { at: Date | null; by: string | null }>();
  for (const scan of scans) {
    const id = Number(scan.packageId);
    if (!id) continue;
    const at = scan.scannedAt ? new Date(scan.scannedAt) : null;
    const when = at && !Number.isNaN(at.getTime()) ? at : null;
    const seen = first.get(id);
    if (!seen || (when && seen.at && when.getTime() < seen.at.getTime()) || (when && !seen.at)) {
      first.set(id, { at: when, by: scan.scannedByName ?? seen?.by ?? null });
    }
  }

  const arrived: ArrivedParcel<T>[] = [];
  const missing: T[] = [];
  for (const parcel of manifest) {
    const check = first.get(parcel.id);
    if (check) arrived.push({ parcel, checkedAt: check.at, checkedBy: check.by });
    else missing.push(parcel);
  }
  arrived.sort((a, b) => (b.checkedAt?.getTime() ?? 0) - (a.checkedAt?.getTime() ?? 0));
  return { arrived, missing };
}

export interface CheckedBatchSummary {
  totalParcels: number;
  arrived: number;
}

/** How many of the batch did not turn up — never below zero. */
export function notArrivedCount(summary: CheckedBatchSummary): number {
  return Math.max(0, Number(summary.totalParcels || 0) - Number(summary.arrived || 0));
}

/** Every parcel of the batch was checked in. */
export function isFullyArrived(summary: CheckedBatchSummary): boolean {
  return Number(summary.totalParcels || 0) > 0 && notArrivedCount(summary) === 0;
}

/** The missing parcels' trackings, one per line, for pasting to the carrier. */
export function missingTrackingList(missing: readonly ManifestParcel[]): string {
  return missing
    .map((parcel) => String(parcel.trackingNumber ?? "").trim())
    .filter(Boolean)
    .join("\n");
}
