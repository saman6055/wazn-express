import { sql, type SQL } from "drizzle-orm";
import { getDb } from "./connection";
import { CHARGE_TX_TYPES, PAYMENT_TX_TYPES } from "@shared/ledgerTypes";
import {
  cartonOverchargeUsd,
  judgeBoxReversal,
  type BoxReversalRow,
  type CartonChargeRow,
  type DriftRow,
  type FreightCollisionRow,
  type LedgerReconciliation,
  type NotOnAccountRow,
  type PriceMismatchRow,
} from "@shared/ledgerReconciliation";

/**
 * The whole-system money check (owner's ledger audit, 2026-09-16).
 *
 * READ ONLY. Every statement here is a SELECT; nothing on any account moves
 * because somebody opened the report. Whatever it finds is for the owner to
 * decide on, and any correction goes through its own preview-then-apply.
 * server/__tests__/ledger-reconciliation-readonly.test.ts keeps it that way.
 */

type Row = Record<string, any>;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Lists are capped for the screen; totals always count everything. */
const LIST_CAP = 300;

const CHARGE_IN = sql.raw(CHARGE_TX_TYPES.map((t) => `'${t}'`).join(", "));
const PAYMENT_IN = sql.raw(PAYMENT_TX_TYPES.map((t) => `'${t}'`).join(", "));

/** Charges and their corrections, net — the same rule as the statement's sales. */
const NET_CHARGE = (alias: string) =>
  sql.raw(
    `CASE WHEN ${alias}.transactionType IN (${CHARGE_TX_TYPES.map((t) => `'${t}'`).join(", ")}) THEN CAST(${alias}.amountUsd AS DECIMAL(14,2)) ` +
      `WHEN ${alias}.transactionType = 'ADJUSTMENT_CREDIT' THEN -CAST(${alias}.amountUsd AS DECIMAL(14,2)) ELSE 0 END`,
  );

/** The prefix reverseBoxSettlement writes on the row that undoes a receipt. */
const RECEIPT_REVERSAL_PREFIX = "هەڵوەشاندنەوەی واصڵی ";

async function select(db: Db, query: SQL): Promise<Row[]> {
  const [rows] = (await db.execute(query)) as unknown as [Row[]];
  return rows ?? [];
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const sumUsd = (values: number[]): number => Math.round(values.reduce((s, v) => s + Math.round(v * 100), 0)) / 100;

export async function getLedgerReconciliation(): Promise<LedgerReconciliation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ---- 1. Accounts whose running balance is not what their rows add up to.
  const [counted] = await select(db, sql`SELECT COUNT(*) AS n FROM customerAccounts`);
  const driftRows = await select(db, sql`
    SELECT a.customerId AS customerId, c.customerCode AS customerCode, c.fullName AS customerName,
           CAST(a.currentBalanceUsd AS DECIMAL(14,2)) AS storedBalance,
           COALESCE(x.fromRows, 0) AS fromRows
    FROM customerAccounts a
    LEFT JOIN customers c ON c.id = a.customerId
    LEFT JOIN (
      SELECT accountId,
             SUM(CASE WHEN transactionType IN (${CHARGE_IN}) THEN CAST(amountUsd AS DECIMAL(14,2))
                      WHEN transactionType IN (${PAYMENT_IN}) THEN -CAST(amountUsd AS DECIMAL(14,2))
                      ELSE 0 END) AS fromRows
      FROM ledgerTransactions
      GROUP BY accountId
    ) x ON x.accountId = a.id
    WHERE ABS(CAST(a.currentBalanceUsd AS DECIMAL(14,2)) - COALESCE(x.fromRows, 0)) > 0.005
    ORDER BY ABS(CAST(a.currentBalanceUsd AS DECIMAL(14,2)) - COALESCE(x.fromRows, 0)) DESC
  `);
  const drift: DriftRow[] = driftRows.map((r) => ({
    customerId: Number(r.customerId),
    customerCode: String(r.customerCode ?? r.customerId),
    customerName: r.customerName ?? null,
    storedBalanceUsd: num(r.storedBalance),
    ledgerBalanceUsd: num(r.fromRows),
    driftUsd: num(num(r.storedBalance) - num(r.fromRows)),
  }));

  // ---- 2. Order cartons a box receipt charged as parcels.
  const cartons = await select(db, sql`
    SELECT i.id AS itemId, i.packageId AS packageId, i.trackingNumber AS trackingNumber,
           b.boxCode AS boxCode, b.customerId AS customerId,
           c.customerCode AS customerCode, c.fullName AS customerName,
           (SELECT COALESCE(SUM(${NET_CHARGE("t")}), 0)
              FROM ledgerTransactions t
             WHERE t.accountId = a.id AND t.referenceType = 'package' AND t.referenceId = i.packageId) AS packageNetUsd
    FROM deliveryBoxItems i
    JOIN deliveryBoxes b ON b.id = i.boxId
    JOIN customers c ON c.id = b.customerId
    JOIN customerAccounts a ON a.customerId = b.customerId
    WHERE i.itemType IN ('commission', 'full_package')
      AND i.packageId IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM ledgerTransactions t2
         WHERE t2.accountId = a.id AND t2.transactionType = 'DEBIT_PACKAGE'
           AND t2.referenceType = 'package' AND t2.referenceId = i.packageId
           AND t2.description LIKE CONCAT(b.boxCode, ' —%')
      )
    ORDER BY i.id
  `);

  const doubleCharged: CartonChargeRow[] = [];
  const trackings = Array.from(new Set(cartons.map((r) => r.trackingNumber).filter((t): t is string => !!t)));
  if (trackings.length > 0) {
    const trackingIn = sql.join(trackings.map((t) => sql`${t}`), sql`, `);
    const linked = await select(db, sql`
      SELECT o.id AS orderId, o.orderCode AS orderCode, o.customerId AS customerId, ot.trackingNumber AS trackingNumber
        FROM fullPackageOrderTrackings ot
        JOIN fullPackageOrders o ON o.id = ot.fullPackageOrderId
       WHERE ot.trackingNumber IN (${trackingIn})
      UNION
      SELECT o.id, o.orderCode, o.customerId, o.trackingNumber
        FROM fullPackageOrders o
       WHERE o.trackingNumber IN (${trackingIn})
    `);
    const orderIds = Array.from(new Set(linked.map((r) => Number(r.orderId))));
    const orderNet = new Map<number, number>();
    if (orderIds.length > 0) {
      const charges = await select(db, sql`
        SELECT o.id AS orderId, COALESCE(SUM(${NET_CHARGE("t")}), 0) AS net
          FROM fullPackageOrders o
          JOIN customerAccounts a ON a.customerId = o.customerId
          JOIN ledgerTransactions t ON t.accountId = a.id AND t.referenceId = o.id
               AND (t.referenceType IN ('full_package', 'commission', 'purchase_request')
                    OR (t.referenceType = 'package' AND t.description LIKE CONCAT('%', o.orderCode, '%')))
         WHERE o.id IN (${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})
         GROUP BY o.id
      `);
      for (const r of charges) orderNet.set(Number(r.orderId), num(r.net));
    }
    // Each order's charge is set against one carton only, so a split order
    // spread over several cartons is not counted as several double charges.
    const remaining = new Map(orderNet);
    for (const carton of cartons) {
      const orders = linked.filter(
        (o) => o.trackingNumber === carton.trackingNumber && Number(o.customerId) === Number(carton.customerId),
      );
      const uniqueOrders = Array.from(new Map(orders.map((o) => [Number(o.orderId), o])).values());
      const available = sumUsd(uniqueOrders.map((o) => remaining.get(Number(o.orderId)) ?? 0));
      const over = cartonOverchargeUsd(carton.packageNetUsd, available);
      if (over <= 0) continue;
      let left = over;
      for (const o of uniqueOrders) {
        const id = Number(o.orderId);
        const take = Math.min(left, remaining.get(id) ?? 0);
        remaining.set(id, num((remaining.get(id) ?? 0) - take));
        left = num(left - take);
      }
      doubleCharged.push({
        customerId: Number(carton.customerId),
        customerCode: String(carton.customerCode ?? carton.customerId),
        customerName: carton.customerName ?? null,
        boxCode: String(carton.boxCode),
        trackingNumber: carton.trackingNumber ?? null,
        packageId: Number(carton.packageId),
        boxChargeUsd: num(carton.packageNetUsd),
        orderCodes: uniqueOrders.map((o) => o.orderCode).join(" + "),
        orderChargesUsd: sumUsd(uniqueOrders.map((o) => orderNet.get(Number(o.orderId)) ?? 0)),
        overchargeUsd: over,
      });
    }
  }

  // ---- 3. Reversed box receipts, against their payment records.
  const reversed = await select(db, sql`
    SELECT s.settlementNumber AS settlementNumber, s.customerId AS customerId,
           c.customerCode AS customerCode, c.fullName AS customerName, b.boxCode AS boxCode,
           s.paidUsd AS paidUsd, s.discountUsd AS discountUsd, s.paymentRecordId AS paymentRecordId,
           p.reversedAmountUsd AS recordReversedUsd, p.reversalTransactionId AS recordReversalTransactionId,
           a.id AS accountId
      FROM boxSettlements s
      JOIN customers c ON c.id = s.customerId
      LEFT JOIN deliveryBoxes b ON b.id = s.boxId
      LEFT JOIN paymentRecords p ON p.id = s.paymentRecordId
      LEFT JOIN customerAccounts a ON a.customerId = s.customerId
     WHERE s.status = 'reversed'
     ORDER BY s.id
  `);
  const reversalRows = reversed.length
    ? await select(db, sql`
        SELECT id, accountId, amountUsd, description
          FROM ledgerTransactions
         WHERE transactionType = 'ADJUSTMENT_DEBIT'
           AND description LIKE ${RECEIPT_REVERSAL_PREFIX + "%"}
      `)
    : [];
  const reversalByReceipt = new Map<string, Row>();
  for (const r of reversalRows) {
    const rest = String(r.description ?? "").slice(RECEIPT_REVERSAL_PREFIX.length);
    const number = rest.split(" —")[0]?.trim();
    if (number) reversalByReceipt.set(`${r.accountId}|${number}`, r);
  }
  const boxReversals: BoxReversalRow[] = [];
  for (const s of reversed) {
    const row = reversalByReceipt.get(`${s.accountId}|${s.settlementNumber}`) ?? null;
    const verdict = judgeBoxReversal({
      paidUsd: s.paidUsd,
      discountUsd: s.discountUsd,
      record: s.paymentRecordId
        ? { reversedAmountUsd: s.recordReversedUsd, reversalTransactionId: s.recordReversalTransactionId == null ? null : Number(s.recordReversalTransactionId) }
        : null,
      reversalRow: row ? { id: Number(row.id), amountUsd: row.amountUsd } : null,
    });
    if (verdict.stillCountedUsd <= 0 && verdict.doubleReversedUsd <= 0) continue;
    boxReversals.push({
      customerId: Number(s.customerId),
      customerCode: String(s.customerCode ?? s.customerId),
      customerName: s.customerName ?? null,
      settlementNumber: String(s.settlementNumber),
      boxCode: s.boxCode ?? null,
      paidUsd: num(s.paidUsd),
      discountUsd: num(s.discountUsd),
      ...verdict,
    });
  }

  // ---- 4. Freight referenced by an order id that is another customer's boxed parcel.
  const collisionRows = await select(db, sql`
    SELECT t.id AS ledgerTransactionId, a.customerId AS customerId, c.customerCode AS customerCode,
           o.orderCode AS orderCode, t.referenceId AS referenceId, t.amountUsd AS amountUsd,
           oc.customerCode AS otherCustomerCode, b.boxCode AS otherBoxCode
      FROM ledgerTransactions t
      JOIN customerAccounts a ON a.id = t.accountId
      JOIN customers c ON c.id = a.customerId
      JOIN fullPackageOrders o ON o.id = t.referenceId AND o.customerId = a.customerId
      LEFT JOIN packages ownParcel ON ownParcel.id = t.referenceId AND ownParcel.customerId = a.customerId
      JOIN deliveryBoxItems i ON i.packageId = t.referenceId
      JOIN deliveryBoxes b ON b.id = i.boxId AND b.customerId <> a.customerId AND b.status <> 'cancelled'
      JOIN customers oc ON oc.id = b.customerId
     WHERE t.referenceType = 'package'
       AND t.transactionType IN ('DEBIT_PACKAGE', 'ADJUSTMENT_DEBIT', 'ADJUSTMENT_CREDIT')
       AND ownParcel.id IS NULL
       AND t.description LIKE CONCAT('%', o.orderCode, '%')
     ORDER BY t.id
  `);
  const freightCollisions: FreightCollisionRow[] = collisionRows.map((r) => ({
    ledgerTransactionId: Number(r.ledgerTransactionId),
    customerId: Number(r.customerId),
    customerCode: String(r.customerCode ?? r.customerId),
    orderCode: r.orderCode ?? null,
    referenceId: Number(r.referenceId),
    amountUsd: num(r.amountUsd),
    otherCustomerCode: String(r.otherCustomerCode ?? ""),
    otherBoxCode: String(r.otherBoxCode ?? ""),
  }));

  // ---- 5. Boxed parcels the account has not been charged for.
  const notOnAccountRows = await select(db, sql`
    SELECT b.customerId AS customerId, c.customerCode AS customerCode, c.fullName AS customerName,
           COUNT(DISTINCT b.id) AS boxes, COUNT(*) AS parcels,
           COALESCE(SUM(CAST(i.calculatedCostUsd AS DECIMAL(14,2))), 0) AS totalUsd
      FROM deliveryBoxItems i
      JOIN deliveryBoxes b ON b.id = i.boxId AND b.status <> 'cancelled'
      JOIN customers c ON c.id = b.customerId
      LEFT JOIN customerAccounts a ON a.customerId = b.customerId
     WHERE i.itemType = 'regular' AND i.packageId IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM ledgerTransactions t
          WHERE t.accountId = a.id AND t.referenceType = 'package' AND t.referenceId = i.packageId
            AND t.transactionType IN (${CHARGE_IN})
       )
       AND NOT EXISTS (
         SELECT 1 FROM boxSettlementLines l
           JOIN boxSettlements s ON s.id = l.settlementId AND s.status = 'confirmed'
          WHERE l.boxItemId = i.id
       )
     GROUP BY b.customerId, c.customerCode, c.fullName
     ORDER BY totalUsd DESC
  `);
  const notOnAccount: NotOnAccountRow[] = notOnAccountRows.map((r) => ({
    customerId: Number(r.customerId),
    customerCode: String(r.customerCode ?? r.customerId),
    customerName: r.customerName ?? null,
    boxes: Number(r.boxes),
    parcels: Number(r.parcels),
    totalUsd: num(r.totalUsd),
  }));

  // ---- 6. Unpaid boxed parcels whose box price is not the account's charge.
  const mismatchRows = await select(db, sql`
    SELECT b.customerId AS customerId, c.customerCode AS customerCode, b.boxCode AS boxCode,
           i.trackingNumber AS trackingNumber, i.packageId AS packageId,
           CAST(i.calculatedCostUsd AS DECIMAL(14,2)) AS boxPriceUsd, x.net AS ledgerChargeUsd
      FROM deliveryBoxItems i
      JOIN deliveryBoxes b ON b.id = i.boxId AND b.status <> 'cancelled'
      JOIN customers c ON c.id = b.customerId
      JOIN customerAccounts a ON a.customerId = b.customerId
      JOIN (
        SELECT t.accountId AS accountId, t.referenceId AS referenceId, SUM(${NET_CHARGE("t")}) AS net
          FROM ledgerTransactions t
         WHERE t.referenceType = 'package'
         GROUP BY t.accountId, t.referenceId
      ) x ON x.accountId = a.id AND x.referenceId = i.packageId
     WHERE i.itemType = 'regular' AND i.packageId IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM boxSettlementLines l
           JOIN boxSettlements s ON s.id = l.settlementId AND s.status = 'confirmed'
          WHERE l.boxItemId = i.id
       )
       AND ABS(CAST(i.calculatedCostUsd AS DECIMAL(14,2)) - x.net) > 0.005
     ORDER BY b.customerId, i.id
  `);
  const priceMismatches: PriceMismatchRow[] = mismatchRows.map((r) => ({
    customerId: Number(r.customerId),
    customerCode: String(r.customerCode ?? r.customerId),
    boxCode: String(r.boxCode),
    trackingNumber: r.trackingNumber ?? null,
    packageId: Number(r.packageId),
    boxPriceUsd: num(r.boxPriceUsd),
    ledgerChargeUsd: num(r.ledgerChargeUsd),
    differenceUsd: num(num(r.boxPriceUsd) - num(r.ledgerChargeUsd)),
  }));

  const stillCounted = boxReversals.filter((r) => r.stillCountedUsd > 0);
  const doubleReversed = boxReversals.filter((r) => r.doubleReversedUsd > 0);
  const lists = [drift, doubleCharged, boxReversals, freightCollisions, notOnAccount, priceMismatches];

  return {
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    accountsChecked: Number(counted?.n ?? 0),
    drift: drift.slice(0, LIST_CAP),
    doubleChargedCartons: doubleCharged.slice(0, LIST_CAP),
    boxReversals: boxReversals.slice(0, LIST_CAP),
    freightCollisions: freightCollisions.slice(0, LIST_CAP),
    notOnAccount: notOnAccount.slice(0, LIST_CAP),
    priceMismatches: priceMismatches.slice(0, LIST_CAP),
    totals: {
      driftAccounts: drift.length,
      driftUsd: sumUsd(drift.map((r) => r.driftUsd)),
      doubleChargedCartons: doubleCharged.length,
      overchargeUsd: sumUsd(doubleCharged.map((r) => r.overchargeUsd)),
      stillCountedReceipts: stillCounted.length,
      stillCountedUsd: sumUsd(stillCounted.map((r) => r.stillCountedUsd)),
      doubleReversedReceipts: doubleReversed.length,
      doubleReversedUsd: sumUsd(doubleReversed.map((r) => r.doubleReversedUsd)),
      freightCollisions: freightCollisions.length,
      notOnAccountParcels: notOnAccount.reduce((s, r) => s + r.parcels, 0),
      notOnAccountUsd: sumUsd(notOnAccount.map((r) => r.totalUsd)),
      priceMismatches: priceMismatches.length,
    },
    truncated: lists.some((list) => list.length > LIST_CAP),
  };
}
