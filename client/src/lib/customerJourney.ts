import {
  stageOf,
  isInIraqNotDelivered,
  orderStageOf,
  isOrderInIraqNotDelivered,
} from "./shipmentFilters";

/**
 * One customer's parcels, sorted onto the five stations of the road:
 * not yet at the China depot → China depot → travelling → in Iraq → handed
 * over. Built from the raw bundles the customerJourney endpoint returns.
 *
 * The classification deliberately lives here, on the client, beside the
 * stage rules the portal home already counts with — a server copy of these
 * decisions is how the counter and the customer's app would learn to tell
 * two different stories about the same parcel.
 *
 * The physical record wins. An order matched to a scanned parcel is
 * classified by the parcel and its batch, whatever the order row still says:
 * the scan happened to a real box on a real shelf.
 */

export type JourneyStation =
  | "not_arrived"
  | "in_china"
  | "on_the_way"
  | "in_iraq"
  | "delivered";

export interface JourneyPackage {
  id: number;
  trackingNumber: string | null;
  packageCode: string;
  status: string;
  batchId: number | null;
  weightKg: string | number | null;
  volumeCbm: string | number | null;
  photo: string | null;
  description: string | null;
  createdAt: string | Date;
  deliveredAt?: string | Date | null;
}

export interface JourneyOrder {
  id: number;
  orderCode: string;
  orderType: string;
  status: string;
  productName: string;
  trackingNumber: string | null;
  trackingNumbers: string[] | null;
  photo: string | null;
  createdAt: string | Date;
}

export interface JourneyDeclared {
  id: number;
  trackingNumber: string;
  status: string;
  productName: string | null;
  photo: string | null;
  createdAt: string | Date;
}

export interface JourneyBoxRow {
  packageId: number;
  boxCode: string;
  boxStatus: string;
  boxCreatedAt?: string | Date | null;
  boxDeliveredAt?: string | Date | null;
}

export interface JourneyBatch {
  id: number;
  batchCode: string;
  status: string;
  shippingType: string;
}

export interface JourneyData {
  packages: JourneyPackage[];
  orders: JourneyOrder[];
  declared: JourneyDeclared[];
  boxed: JourneyBoxRow[];
  batches: JourneyBatch[];
}

export interface JourneyItem {
  key: string;
  source: "order" | "declared" | "scan";
  station: JourneyStation;
  tracking: string | null;
  title: string | null;
  /** Product photo from the order/declaration, else the warehouse scan photo. */
  photo: string | null;
  /** True when the photo is the warehouse scan, not the shop listing. */
  scanPhoto: boolean;
  orderType: string | null;
  weightKg: number | null;
  volumeCbm: number | null;
  batchCode: string | null;
  /** The batch's raw status, for the shared label maps. */
  batchStatus: string | null;
  boxCode: string | null;
  boxStatus: string | null;
  /** When the box changed hands, else when it was packed. */
  boxDate: Date | null;
  packageCode: string | null;
  /** When the depot scanned it in. */
  scannedAt: Date | null;
  /** When it reached the customer — the parcel's own record, else the box's. */
  deliveredAt: Date | null;
  registeredAt: Date;
  /** Days since registration; the not-arrived station's "check with the seller" clock. */
  waitingDays: number;
  /**
   * Other orders riding in this same physical carton (shared tracking).
   * They fold into the parcel's one row instead of drawing their own — the
   * box receipt counts scanned parcels, and the panel must count the same
   * thing or the owner is left hunting for pieces that were never missing.
   */
  sharedOrders: Array<{ code: string; title: string | null; orderType: string | null }>;
}

export interface JourneyCohort {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  items: JourneyItem[];
  /** Reached at least the China depot. */
  arrived: number;
  pending: number;
}

export interface CustomerJourney {
  counts: Record<JourneyStation, number>;
  /** Orders and portal declarations, grouped by the day they were entered. */
  orderCohorts: JourneyCohort[];
  /** Parcels scanned straight in with no order behind them, by scan day. */
  scanCohorts: JourneyCohort[];
}

const DAY_MS = 86_400_000;

const asDate = (v: string | Date): Date => (v instanceof Date ? v : new Date(v));

/** Local calendar key — the staff member's clock is the office clock. */
export function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const num = (v: string | number | null): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * A parcel's own status, projected onto the journey — used only when it has
 * no batch to answer for it. customs_processing onward is Iraqi soil.
 */
const PACKAGE_STATION: Record<string, JourneyStation> = {
  registered: "in_china",
  in_batch: "in_china",
  in_transit: "on_the_way",
  customs_processing: "in_iraq",
  ready_for_delivery: "in_iraq",
  out_for_delivery: "in_iraq",
  delivered: "delivered",
};

function packageStation(
  pkg: JourneyPackage,
  batch: JourneyBatch | undefined,
  box: JourneyBoxRow | undefined,
): JourneyStation | null {
  // Ghost rows carry no journey: a cancelled parcel is nowhere, a returned
  // one is a separate conversation, not a station on the road.
  if (pkg.status === "cancelled" || pkg.status === "returned") return null;
  if (box?.boxStatus === "delivered") return "delivered";
  if (pkg.status === "delivered") return "delivered";
  // Packed into a box that has not been handed over: physically Erbil.
  if (box) return "in_iraq";
  if (batch) {
    const stage = stageOf(batch.status);
    if (stage === "delivered") return "delivered";
    if (stage === "in_china") return "in_china";
    if (stage === "in_transit") {
      return isInIraqNotDelivered(batch.status) ? "in_iraq" : "on_the_way";
    }
  }
  return PACKAGE_STATION[pkg.status] ?? "in_china";
}

function orderStation(status: string): JourneyStation {
  const stage = orderStageOf(status);
  if (stage === null) {
    // quoted / approved / ordered — bought, perhaps, but nothing has reached
    // the depot. delivered maps in the ladder, so null truly means "before".
    return "not_arrived";
  }
  if (stage === "delivered") return "delivered";
  if (stage === "in_china") return "in_china";
  return isOrderInIraqNotDelivered(status) ? "in_iraq" : "on_the_way";
}

/** Every tracking an order answers to, primary column and json list alike. */
function orderTrackings(o: JourneyOrder): string[] {
  const all = [o.trackingNumber, ...(o.trackingNumbers ?? [])];
  return Array.from(new Set(all.filter((t): t is string => !!t && t.trim().length > 0).map(t => t.trim())));
}

export function buildCustomerJourney(data: JourneyData, now: Date = new Date()): CustomerJourney {
  const batchById = new Map(data.batches.map(b => [b.id, b]));
  const boxByPackageId = new Map(data.boxed.map(b => [b.packageId, b]));
  const packageByTracking = new Map<string, JourneyPackage>();
  for (const p of data.packages) {
    if (p.trackingNumber) packageByTracking.set(p.trackingNumber.trim(), p);
  }

  const consumedPackageIds = new Set<number>();
  const items: JourneyItem[] = [];

  const push = (item: JourneyItem | null) => {
    if (item) items.push(item);
  };

  const fromPackage = (
    pkg: JourneyPackage,
    base: { key: string; source: JourneyItem["source"]; title: string | null; photo: string | null; orderType: string | null; registeredAt: Date },
  ): JourneyItem | null => {
    const batch = pkg.batchId != null ? batchById.get(pkg.batchId) : undefined;
    const box = boxByPackageId.get(pkg.id);
    const station = packageStation(pkg, batch, box);
    if (station === null) return null;
    const scanPhoto = base.photo === null && pkg.photo !== null;
    const boxDate = box ? asDate((box.boxDeliveredAt ?? box.boxCreatedAt ?? "") as string | Date) : null;
    const deliveredAt = pkg.deliveredAt
      ? asDate(pkg.deliveredAt)
      : box?.boxStatus === "delivered" && box.boxDeliveredAt
        ? asDate(box.boxDeliveredAt)
        : null;
    return {
      key: base.key,
      source: base.source,
      station,
      tracking: pkg.trackingNumber,
      title: base.title ?? pkg.description,
      photo: base.photo ?? pkg.photo,
      scanPhoto,
      orderType: base.orderType,
      weightKg: num(pkg.weightKg),
      volumeCbm: num(pkg.volumeCbm),
      batchCode: batch?.batchCode ?? null,
      batchStatus: batch?.status ?? null,
      boxCode: box?.boxCode ?? null,
      boxStatus: box?.boxStatus ?? null,
      boxDate: boxDate && !Number.isNaN(boxDate.getTime()) ? boxDate : null,
      packageCode: pkg.packageCode,
      scannedAt: asDate(pkg.createdAt),
      deliveredAt: deliveredAt && !Number.isNaN(deliveredAt.getTime()) ? deliveredAt : null,
      registeredAt: base.registeredAt,
      waitingDays: Math.max(0, Math.floor((now.getTime() - base.registeredAt.getTime()) / DAY_MS)),
      sharedOrders: [],
    };
  };

  // One physical parcel, one row. Several orders can share a carton (shared
  // tracking); the first materialises the parcel, the rest fold into it.
  const itemByPackageId = new Map<number, JourneyItem>();

  for (const o of data.orders) {
    const registeredAt = asDate(o.createdAt);
    const matched = orderTrackings(o)
      .map(t => packageByTracking.get(t))
      .find((p): p is JourneyPackage => !!p);
    const base = {
      key: `order-${o.id}`,
      source: "order" as const,
      title: o.productName,
      photo: o.photo,
      orderType: o.orderType,
      registeredAt,
    };
    if (matched) {
      const existing = itemByPackageId.get(matched.id);
      if (existing) {
        existing.sharedOrders.push({ code: o.orderCode, title: o.productName, orderType: o.orderType });
        continue;
      }
      consumedPackageIds.add(matched.id);
      const item = fromPackage(matched, base);
      if (item) itemByPackageId.set(matched.id, item);
      push(item);
    } else {
      const station = orderStation(o.status);
      push({
        ...base,
        station,
        tracking: o.trackingNumber,
        scanPhoto: false,
        weightKg: null,
        volumeCbm: null,
        batchCode: null,
        batchStatus: null,
        boxCode: null,
        boxStatus: null,
        boxDate: null,
        packageCode: null,
        scannedAt: null,
        deliveredAt: null,
        waitingDays: Math.max(0, Math.floor((now.getTime() - registeredAt.getTime()) / DAY_MS)),
        sharedOrders: [],
      });
    }
  }

  for (const d of data.declared) {
    const registeredAt = asDate(d.createdAt);
    const matched = packageByTracking.get(d.trackingNumber.trim());
    const base = {
      key: `declared-${d.id}`,
      source: "declared" as const,
      title: d.productName,
      photo: d.photo,
      orderType: null,
      registeredAt,
    };
    if (matched) {
      // Already told through an order? The order told it; the declaration
      // was the same parcel announced twice.
      if (consumedPackageIds.has(matched.id)) continue;
      consumedPackageIds.add(matched.id);
      push(fromPackage(matched, base));
    } else {
      push({
        ...base,
        station: "not_arrived",
        tracking: d.trackingNumber,
        scanPhoto: false,
        weightKg: null,
        volumeCbm: null,
        batchCode: null,
        batchStatus: null,
        boxCode: null,
        boxStatus: null,
        boxDate: null,
        packageCode: null,
        scannedAt: null,
        deliveredAt: null,
        waitingDays: Math.max(0, Math.floor((now.getTime() - registeredAt.getTime()) / DAY_MS)),
        sharedOrders: [],
      });
    }
  }

  const looseItems: JourneyItem[] = [];
  for (const p of data.packages) {
    if (consumedPackageIds.has(p.id)) continue;
    const registeredAt = asDate(p.createdAt);
    const item = fromPackage(p, {
      key: `pkg-${p.id}`,
      source: "scan",
      title: p.description,
      photo: null,
      orderType: null,
      registeredAt,
    });
    if (item) looseItems.push(item);
  }

  const counts: Record<JourneyStation, number> = {
    not_arrived: 0,
    in_china: 0,
    on_the_way: 0,
    in_iraq: 0,
    delivered: 0,
  };
  for (const it of [...items, ...looseItems]) counts[it.station] += 1;

  const toCohorts = (list: JourneyItem[]): JourneyCohort[] => {
    const byDate = new Map<string, JourneyItem[]>();
    for (const it of list) {
      const key = localDateKey(it.registeredAt);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(it);
      else byDate.set(key, [it]);
    }
    return Array.from(byDate.entries())
      .map(([date, cohortItems]) => {
        // The ones still missing float to the top: they are what the call
        // is about.
        const sorted = [...cohortItems].sort((a, b) => {
          const ap = a.station === "not_arrived" ? 0 : 1;
          const bp = b.station === "not_arrived" ? 0 : 1;
          return ap - bp;
        });
        const pending = sorted.filter(i => i.station === "not_arrived").length;
        return { date, items: sorted, arrived: sorted.length - pending, pending };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  return {
    counts,
    orderCohorts: toCohorts(items),
    scanCohorts: toCohorts(looseItems),
  };
}
