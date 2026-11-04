import { sql } from "drizzle-orm";
import { getDb } from "./connection";
import { appLogger } from "../utils/logger";

/**
 * The records behind the dashboard's problem cards, and the four box and
 * batch problems the owner asked to be told about (2026-11-05):
 *   - a carton in a customer's box that was never registered as a parcel;
 *   - a parcel in a box with no weight (charged on nothing);
 *   - a parcel in a box with a weight but no price (never charged);
 *   - a carton left behind: its China batch reached Erbil, it was never
 *     checked in.
 * Read only. Each finding is a line a person can open and put right.
 */

export interface ProblemRecord {
  text: string;
  href?: string;
}

const LIMIT = 12;
type Row = Record<string, unknown>;

async function rows(label: string, query: ReturnType<typeof sql>): Promise<Row[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const [r] = (await db.execute(query)) as unknown as [Row[]];
    return Array.isArray(r) ? r : [];
  } catch (error) {
    appLogger.warn(`[dashboard problems] ${label} failed`, { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

const str = (v: unknown) => (v == null ? "" : String(v));
const usd = (v: unknown) => `$${(Number(v) || 0).toFixed(2)}`;
const boxHref = (id: unknown) => `/customer-delivery-scanner?box=${str(id)}`;
const parcelHref = (code: unknown) => `/packages/all?search=${encodeURIComponent(str(code))}`;
const orderHref = (id: unknown, type: unknown) => (str(type) === "commission" ? `/commission/${str(id)}` : `/full-package/${str(id)}`);
const join = (...xs: unknown[]) => xs.map(str).filter(Boolean).join(" · ");

/** Boxes still being worked: not cancelled, not handed over. */
const LIVE_BOX = sql.raw(`b.status IN ('open','ready','in_transit')`);

export interface BoxProblem {
  id: "box-unregistered" | "box-no-weight" | "box-no-price" | "left-behind";
  count: number;
  records: ProblemRecord[];
}

export async function getBoxProblems(): Promise<BoxProblem[]> {
  const [unregistered, noWeight, noPrice, behind] = await Promise.all([
    rows("box-unregistered", sql`
      SELECT b.id AS boxId, b.boxCode, c.customerCode, i.trackingNumber, COUNT(*) OVER () AS total
      FROM deliveryBoxItems i
      JOIN deliveryBoxes b ON b.id = i.boxId
      LEFT JOIN customers c ON c.id = b.customerId
      WHERE ${LIVE_BOX} AND i.packageId IS NULL AND i.fullPackageOrderId IS NULL
      ORDER BY i.id DESC LIMIT ${LIMIT}`),
    rows("box-no-weight", sql`
      SELECT b.id AS boxId, b.boxCode, c.customerCode, p.packageCode, p.trackingNumber, COUNT(*) OVER () AS total
      FROM deliveryBoxItems i
      JOIN deliveryBoxes b ON b.id = i.boxId
      JOIN packages p ON p.id = i.packageId
      LEFT JOIN customers c ON c.id = b.customerId
      WHERE ${LIVE_BOX}
        AND CAST(COALESCE(p.weightKg, 0) AS DECIMAL(12,3)) <= 0
        AND CAST(COALESCE(p.volumeCbm, 0) AS DECIMAL(12,4)) <= 0
        AND p.fullPackageOrderId IS NULL
      ORDER BY i.id DESC LIMIT ${LIMIT}`),
    rows("box-no-price", sql`
      SELECT b.id AS boxId, b.boxCode, c.customerCode, p.packageCode, p.trackingNumber, p.weightKg, COUNT(*) OVER () AS total
      FROM deliveryBoxItems i
      JOIN deliveryBoxes b ON b.id = i.boxId
      JOIN packages p ON p.id = i.packageId
      LEFT JOIN customers c ON c.id = b.customerId
      WHERE ${LIVE_BOX}
        AND CAST(COALESCE(p.weightKg, 0) AS DECIMAL(12,3)) > 0
        AND CAST(COALESCE(p.calculatedCostUsd, 0) AS DECIMAL(12,2)) <= 0
        AND p.fullPackageOrderId IS NULL
        AND COALESCE(p.isUnclaimed, 0) = 0
      ORDER BY i.id DESC LIMIT ${LIMIT}`),
    rows("left-behind", sql`
      SELECT p.packageCode, p.trackingNumber, c.customerCode, bt.batchCode, COUNT(*) OVER () AS total
      FROM packages p
      JOIN batches bt ON bt.id = p.batchId
      JOIN countries cn ON cn.id = bt.createdInCountryId AND cn.isoCode = 'CN'
      LEFT JOIN customers c ON c.id = p.customerId
      WHERE bt.status IN ('at_depot','delivered','closed')
        AND p.status IN ('registered','in_batch','in_transit')
        AND p.lostAt IS NULL
        AND NOT EXISTS (SELECT 1 FROM packageScans s WHERE s.packageId = p.id AND s.scanType = 'received_local')
      ORDER BY bt.id DESC, p.id DESC LIMIT ${LIMIT}`),
  ]);

  const total = (r: Row[]) => Number(r[0]?.total ?? 0);
  return [
    {
      id: "box-unregistered",
      count: total(unregistered),
      records: unregistered.map((r) => ({ text: join(r.boxCode, r.customerCode, r.trackingNumber), href: boxHref(r.boxId) })),
    },
    {
      id: "box-no-weight",
      count: total(noWeight),
      records: noWeight.map((r) => ({ text: join(r.boxCode, r.customerCode, r.packageCode, r.trackingNumber), href: parcelHref(r.trackingNumber || r.packageCode) })),
    },
    {
      id: "box-no-price",
      count: total(noPrice),
      records: noPrice.map((r) => ({ text: join(r.boxCode, r.customerCode, r.packageCode, `${(Number(r.weightKg) || 0).toFixed(2)} kg`), href: parcelHref(r.trackingNumber || r.packageCode) })),
    },
    {
      id: "left-behind",
      count: total(behind),
      records: behind.map((r) => ({ text: join(r.batchCode, r.customerCode, r.packageCode, r.trackingNumber), href: parcelHref(r.trackingNumber || r.packageCode) })),
    },
  ];
}

/**
 * Parcels and batches running late, counted on the server over all of them,
 * each with its records (audit 2026-11-05). The tiles they replace read the
 * 500 newest parcels and the 50 newest batches, counted parcels already in
 * Erbil as late, and called «1–5 days past the ETA» «near the ETA».
 *
 * A parcel is late by days since it was registered, while it has not reached
 * Erbil (registered, in a batch or on the road), is not unclaimed and not
 * written off as lost. A batch is late by its ETA, or by its departure when it
 * has none, until it reaches the depot.
 */
export interface LateAlert {
  id: "parcels-late-high" | "parcels-late-warn" | "batches-late-high" | "batches-late-warn";
  type: "error" | "warning";
  title: string;
  description: string;
  count: number;
  link: string;
  records: ProblemRecord[];
}

export async function getLateAlerts(): Promise<LateAlert[]> {
  const parcelSql = (min: number, max: number | null) => sql`
    SELECT p.packageCode, p.trackingNumber, c.customerCode, bt.batchCode,
           FLOOR(TIMESTAMPDIFF(SECOND, p.createdAt, UTC_TIMESTAMP()) / 86400) AS days,
           COUNT(*) OVER () AS total
    FROM packages p
    LEFT JOIN customers c ON c.id = p.customerId
    LEFT JOIN batches bt ON bt.id = p.batchId
    WHERE p.status IN ('registered','in_batch','in_transit')
      AND COALESCE(p.isUnclaimed, 0) = 0
      AND p.lostAt IS NULL
      AND TIMESTAMPDIFF(SECOND, p.createdAt, UTC_TIMESTAMP()) > ${min * 86400}
      ${max == null ? sql`` : sql`AND TIMESTAMPDIFF(SECOND, p.createdAt, UTC_TIMESTAMP()) <= ${max * 86400}`}
    ORDER BY p.createdAt ASC LIMIT ${LIMIT}`;
  const batchSql = sql`
    SELECT batchCode, status,
           CASE WHEN estimatedArrival IS NOT NULL THEN DATEDIFF(UTC_TIMESTAMP(), estimatedArrival) END AS pastEta,
           CASE WHEN estimatedArrival IS NULL AND departureDate IS NOT NULL THEN DATEDIFF(UTC_TIMESTAMP(), departureDate) END AS sinceDeparture
    FROM batches
    WHERE status NOT IN ('arrived','at_depot','delivered','closed')
      AND (estimatedArrival IS NOT NULL OR departureDate IS NOT NULL)`;
  const [high, warn, batchRows] = await Promise.all([
    rows("late-parcels-high", parcelSql(20, null)),
    rows("late-parcels-warn", parcelSql(10, 20)),
    rows("late-batches", batchSql),
  ]);

  const level = (r: Row): "high" | "warn" | null => {
    const eta = r.pastEta == null ? null : Number(r.pastEta);
    const dep = r.sinceDeparture == null ? null : Number(r.sinceDeparture);
    if (eta != null) return eta > 5 ? "high" : eta > 0 ? "warn" : null;
    if (dep != null) return dep > 30 ? "high" : dep > 15 ? "warn" : null;
    return null;
  };
  const batchRecord = (r: Row): ProblemRecord => ({
    text: join(r.batchCode, r.pastEta != null ? `${Number(r.pastEta)} ڕۆژ دوای ETA` : `${Number(r.sinceDeparture)} ڕۆژ لە ڕێگا`),
    href: `/batches?find=${encodeURIComponent(str(r.batchCode))}`,
  });
  const highBatches = batchRows.filter((r) => level(r) === "high");
  const warnBatches = batchRows.filter((r) => level(r) === "warn");
  const parcelRecord = (r: Row): ProblemRecord => ({ text: join(r.packageCode, r.customerCode, r.batchCode, `${Number(r.days)} ڕۆژ`), href: parcelHref(r.trackingNumber || r.packageCode) });
  const total = (r: Row[]) => Number(r[0]?.total ?? 0);

  const out: LateAlert[] = [];
  if (total(high) > 0) out.push({ id: "parcels-late-high", type: "error", title: "پاکەتی زۆر دواکەوتوو", description: "زیاتر لە 20 ڕۆژە تۆمار کراوە و هێشتا نەگەیشتووەتە هەولێر", count: total(high), link: "/packages/all", records: high.map(parcelRecord) });
  if (total(warn) > 0) out.push({ id: "parcels-late-warn", type: "warning", title: "پاکەتی ئاگاداری", description: "10–20 ڕۆژە تۆمار کراوە و هێشتا نەگەیشتووەتە هەولێر", count: total(warn), link: "/packages/all", records: warn.map(parcelRecord) });
  if (highBatches.length > 0) out.push({ id: "batches-late-high", type: "error", title: "باچی زۆر دواکەوتوو", description: "زیاتر لە 5 ڕۆژ لە ETA تێپەڕیوە (یان بێ ETA زیاتر لە 30 ڕۆژ لە ڕێگایە)", count: highBatches.length, link: "/batches?status=in_transit", records: highBatches.slice(0, LIMIT).map(batchRecord) });
  if (warnBatches.length > 0) out.push({ id: "batches-late-warn", type: "warning", title: "باچی دواکەوتوو", description: "1–5 ڕۆژ لە ETA تێپەڕیوە (یان بێ ETA 15–30 ڕۆژ لە ڕێگایە)", count: warnBatches.length, link: "/batches?status=in_transit", records: warnBatches.slice(0, LIMIT).map(batchRecord) });
  return out;
}

/** The records behind the existing problem cards. */
export async function getAlertRecords(): Promise<Record<string, ProblemRecord[]>> {
  const [large, customs, pendingFp, delivered, payments] = await Promise.all([
    rows("large-orders", sql`
      SELECT o.id, o.orderType, o.orderCode, c.customerCode,
             CAST(COALESCE(o.sellingPriceUsd, o.itemPriceUsd, '0') AS DECIMAL(12,2)) * COALESCE(o.quantity, 1) AS value
      FROM fullPackageOrders o LEFT JOIN customers c ON c.id = o.customerId
      WHERE o.deletedAt IS NULL
        AND o.status NOT IN ('delivered','cancelled','refunded','returned','rejected')
        AND CAST(COALESCE(o.sellingPriceUsd, o.itemPriceUsd, '0') AS DECIMAL(12,2)) * COALESCE(o.quantity, 1) >= 1000
      ORDER BY value DESC LIMIT ${LIMIT}`),
    rows("customs", sql`SELECT batchCode FROM batches WHERE status = 'customs' ORDER BY id DESC LIMIT ${LIMIT}`),
    rows("pending-fp", sql`
      SELECT o.id, o.orderType, o.orderCode, c.customerCode FROM fullPackageOrders o LEFT JOIN customers c ON c.id = o.customerId
      WHERE o.status = 'pending' AND o.deletedAt IS NULL ORDER BY o.id DESC LIMIT ${LIMIT}`),
    rows("today-deliveries", sql`
      SELECT p.packageCode, p.trackingNumber, c.customerCode FROM packages p LEFT JOIN customers c ON c.id = p.customerId
      WHERE p.status = 'delivered' AND p.deliveredAt >= CURDATE() ORDER BY p.deliveredAt DESC LIMIT ${LIMIT}`),
    rows("today-payments", sql`
      SELECT r.paymentNumber, r.amountUsd, a.customerId, c.customerCode FROM paymentRecords r
      JOIN customerAccounts a ON a.id = r.accountId LEFT JOIN customers c ON c.id = a.customerId
      WHERE r.createdAt >= CURDATE() ORDER BY r.createdAt DESC LIMIT ${LIMIT}`),
  ]);
  return {
    "large-orders": large.map((r) => ({ text: join(r.orderCode, r.customerCode, usd(r.value)), href: orderHref(r.id, r.orderType) })),
    customs: customs.map((r) => ({ text: str(r.batchCode), href: `/batches?find=${encodeURIComponent(str(r.batchCode))}` })),
    "pending-fp": pendingFp.map((r) => ({ text: join(r.orderCode, r.customerCode), href: orderHref(r.id, r.orderType) })),
    "today-deliveries": delivered.map((r) => ({ text: join(r.packageCode, r.customerCode), href: parcelHref(r.trackingNumber || r.packageCode) })),
    "today-payments": payments.map((r) => ({ text: join(r.paymentNumber, r.customerCode, usd(r.amountUsd)), href: `/finance/customer/${str(r.customerId)}` })),
  };
}
