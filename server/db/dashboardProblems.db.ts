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
