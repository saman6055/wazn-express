import { and, eq, inArray, ne, or } from "drizzle-orm";
import { getDb } from "./connection";
import { customers, deliveryBoxItems, deliveryBoxes, fullPackageOrders, packageScans, packages } from "../../drizzle/schema";
import { getVolumetricDivisor } from "./settings.db";
import { orderNumbersForPackages } from "./orderNumbers.db";
import { getBoxesPaidInFull, getBoxSettlementView } from "./boxSettlement.db";
import {
  lacksBillingMeasure,
  needsArrivalCheck,
  parcelEnded,
  type CloseCheckBox,
  type CloseCheckParcel,
} from "@shared/batchCloseCheck";

/**
 * The cartons and boxes to look at before a batch is closed (owner,
 * 2026-09-18). What each finding means lives in shared/batchCloseCheck.ts;
 * this only gathers. Read-only.
 */

/** How many unpaid boxes get their exact balance asked for — each is its own lookup. */
const BALANCE_LOOKUP_CAP = 60;

export interface BatchCloseFacts {
  /** Not in any box that is not cancelled. */
  unboxed: CloseCheckParcel[];
  /** No arrival scan (received_local), and not yet handed over. */
  notArrivalChecked: CloseCheckParcel[];
  /** Nothing to bill it by — a full-package carton, paid by its order's agreed price, aside. */
  unmeasured: CloseCheckParcel[];
  /** Nobody's: no customer on it. */
  ownerless: CloseCheckParcel[];
  /** Boxes holding this batch's cartons, or made for it, that still owe money. */
  unpaidBoxes: CloseCheckBox[];
  /** More boxes were unpaid than were asked for their balance. */
  unpaidBoxesCapped: boolean;
}

const none = (): BatchCloseFacts => ({
  unboxed: [],
  notArrivalChecked: [],
  unmeasured: [],
  ownerless: [],
  unpaidBoxes: [],
  unpaidBoxesCapped: false,
});

const firstPhoto = (photos: unknown): string | null =>
  Array.isArray(photos) && typeof photos[0] === "string" && photos[0] ? photos[0] : null;

export async function getBatchCloseFacts(batchId: number): Promise<BatchCloseFacts> {
  const db = await getDb();
  if (!db) return none();

  const rows = await db
    .select({
      pkg: packages,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      customerMobile: customers.mobileNumber,
    })
    .from(packages)
    .leftJoin(customers, eq(customers.id, packages.customerId))
    .where(eq(packages.batchId, batchId));
  const live = rows.filter((r) => !parcelEnded(r.pkg.status));
  if (live.length === 0) return none();

  const ids = live.map((r) => r.pkg.id);
  const trackings = Array.from(new Set(live.map((r) => r.pkg.trackingNumber).filter((t): t is string => !!t)));

  // In a box: by the parcel, or by its tracking — a box item carries both.
  const boxed = await db
    .select({ boxId: deliveryBoxItems.boxId, packageId: deliveryBoxItems.packageId, trackingNumber: deliveryBoxItems.trackingNumber })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, deliveryBoxItems.boxId))
    .where(
      and(
        ne(deliveryBoxes.status, "cancelled"),
        trackings.length > 0
          ? or(inArray(deliveryBoxItems.packageId, ids), inArray(deliveryBoxItems.trackingNumber, trackings))
          : inArray(deliveryBoxItems.packageId, ids),
      ),
    );
  const boxedIds = new Set(boxed.map((r) => r.packageId).filter((id): id is number => id != null));
  const boxedTrackings = new Set(boxed.map((r) => r.trackingNumber).filter((t): t is string => !!t));

  // Checked in on arrival: the arrival scanner writes a received_local scan.
  const scans = await db
    .select({ packageId: packageScans.packageId, trackingNumber: packageScans.trackingNumber })
    .from(packageScans)
    .where(
      and(
        eq(packageScans.scanType, "received_local"),
        trackings.length > 0
          ? or(inArray(packageScans.packageId, ids), inArray(packageScans.trackingNumber, trackings))
          : inArray(packageScans.packageId, ids),
      ),
    );
  const scannedIds = new Set(scans.map((r) => r.packageId).filter((id): id is number => id != null));
  const scannedTrackings = new Set(scans.map((r) => r.trackingNumber).filter((t): t is string => !!t));

  // A full-package carton is paid by its order's agreed price, not by weight.
  const mainOrderIds = Array.from(new Set(live.map((r) => r.pkg.fullPackageOrderId).filter((id): id is number => id != null)));
  const fullPackageOrderIds = new Set(
    mainOrderIds.length > 0
      ? (
          await db
            .select({ id: fullPackageOrders.id })
            .from(fullPackageOrders)
            .where(and(inArray(fullPackageOrders.id, mainOrderIds), eq(fullPackageOrders.orderType, "full_package")))
        ).map((r) => r.id)
      : [],
  );

  const divisor = await getVolumetricDivisor();
  const numbers = await orderNumbersForPackages(ids);

  const carton = (r: (typeof live)[number]): CloseCheckParcel => ({
    id: r.pkg.id,
    packageCode: r.pkg.packageCode,
    trackingNumber: r.pkg.trackingNumber,
    customerId: r.pkg.customerId,
    customerCode: r.customerCode ?? null,
    customerName: r.customerName ?? null,
    customerMobile: r.customerMobile ?? null,
    shippingType: r.pkg.shippingType,
    weightKg: r.pkg.weightKg,
    volumeCbm: r.pkg.volumeCbm,
    lengthCm: r.pkg.lengthCm,
    widthCm: r.pkg.widthCm,
    heightCm: r.pkg.heightCm,
    registeredAt: r.pkg.registeredAt,
    batchId,
    photo: firstPhoto(r.pkg.photos),
    orderNumbers: numbers.get(r.pkg.id) ?? [],
  });
  const has = (idSet: Set<number>, trackingSet: Set<string>, r: (typeof live)[number]) =>
    idSet.has(r.pkg.id) || (!!r.pkg.trackingNumber && trackingSet.has(r.pkg.trackingNumber));

  const unboxed = live.filter((r) => !has(boxedIds, boxedTrackings, r)).map(carton);
  const notArrivalChecked = live
    .filter((r) => needsArrivalCheck(r.pkg.status) && !has(scannedIds, scannedTrackings, r))
    .map(carton);
  const unmeasured = live
    .filter((r) => !(r.pkg.fullPackageOrderId && fullPackageOrderIds.has(r.pkg.fullPackageOrderId)))
    .filter((r) => lacksBillingMeasure(r.pkg, divisor))
    .map(carton);
  const ownerless = live.filter((r) => !r.pkg.customerId).map(carton);

  // The boxes: holding this batch's cartons, or made for it. A box paid in
  // full is left out at once; the rest are asked their balance — the same
  // one the box's payment screen shows.
  const madeFor = await db
    .select({ id: deliveryBoxes.id })
    .from(deliveryBoxes)
    .where(and(eq(deliveryBoxes.batchId, batchId), ne(deliveryBoxes.status, "cancelled")));
  const boxIds = Array.from(new Set([...boxed.map((r) => r.boxId), ...madeFor.map((b) => b.id)]));
  const paid = await getBoxesPaidInFull(boxIds);
  const unpaidIds = boxIds.filter((id) => !paid.has(id));
  const unpaidBoxes: CloseCheckBox[] = [];
  for (const boxId of unpaidIds.slice(0, BALANCE_LOOKUP_CAP)) {
    const view = await getBoxSettlementView(boxId);
    if (!view.box) continue;
    const owed = view.parcels.reduce((sum, p) => sum + Math.max(0, Number(p.outstandingUsd) || 0), 0);
    if (owed <= 0.005) continue;
    unpaidBoxes.push({
      boxId,
      boxCode: view.box.boxCode,
      status: view.box.status,
      customerCode: view.customer?.customerCode ?? null,
      customerName: view.customer?.fullName ?? null,
      outstandingUsd: Math.round(owed * 100) / 100,
    });
  }

  return {
    unboxed,
    notArrivalChecked,
    unmeasured,
    ownerless,
    unpaidBoxes: unpaidBoxes.sort((a, b) => b.outstandingUsd - a.outstandingUsd),
    unpaidBoxesCapped: unpaidIds.length > BALANCE_LOOKUP_CAP,
  };
}
