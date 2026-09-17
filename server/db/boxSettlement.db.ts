import { eq, and, or, desc, inArray, sql, gte, lte } from "drizzle-orm";
import { SETTLED_SLACK_USD } from "@shared/archive";
import { generateTransactionNumber } from "./utils.db";
import { getDb } from "./connection";
import { withParcelOrderNumbers } from "./orderNumbers.db";
import {
  boxSettlements,
  boxSettlementLines,
  ledgerTransactions,
  customerAccounts,
  paymentRecords,
} from "../../drizzle/schema/finance.schema";
import { deliveryBoxes, deliveryBoxItems, packages, fullPackageOrders, fullPackageOrderTrackings } from "../../drizzle/schema";
import { orderAdvancePaidUsd, type AdvanceSource } from "@shared/orderAdvance";
import { customers, users } from "../../drizzle/schema/users.schema";
import { batches } from "../../drizzle/schema/batches.schema";
import type { BoxSettlement } from "../../drizzle/schema/finance.schema";
import { appLogger } from "../utils/logger";
import { recordPaymentReceived, adjustCharge, recordPackageChargeWithoutInvoice } from "./finance.db";
import { createCustomerNotification } from "./portal.db";
import { markLinkedOrdersCharged } from "./packages.db";
import { notifyPaymentReceived } from "../services/customerWhatsApp.service";
import {
  settlementTotals,
  differenceOf,
  boxDiscountUsd,
  allocateBoxDiscount,
  type ParcelIntent,
  type DiscountReason,
  type BoxDiscount,
} from "@shared/boxSettlement";

/**
 * Money coming back through the box.
 *
 * The charge a customer owes is already recorded, per parcel, as one
 * DEBIT_PACKAGE in the ledger — written when the batch was delivered. The
 * customer's balance and everything the portal shows are computed from those
 * rows. Nothing here writes a second copy of what is owed; it would become a
 * second opinion, and on a money screen a second opinion is how the first one
 * stops being trusted.
 *
 * What this adds is the missing half: which parcels a payment settles. That
 * one fact answers the whole of what the owner asked for — receipting a box
 * while one parcel is left in dispute, discounts that can be reported on,
 * corrections when a price was wrong in either direction, and a shortfall
 * that either stays owed or is forgiven, but never disappears quietly.
 */

/** Ledger types that put money onto a parcel. */
const CHARGE_TYPES = [
  "DEBIT_PACKAGE", "DEBIT_FULL_PACKAGE", "DEBIT_PURCHASE_REQUEST",
  "DEBIT_COMMISSION", "DEBIT_SERVICE", "DEBIT_PENALTY", "DEBIT_OTHER",
] as const;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * RCP-20260828-0001.
 *
 * Sequential rather than the random suffix used elsewhere in this file: this
 * number is printed on a receipt that goes home with a customer, and two
 * receipts with the same number is the kind of thing that is discovered
 * during an argument about money. Max-plus-one can only collide with a row
 * that is no longer there, and settlements are never deleted.
 */
async function nextSettlementNumber(tx: any, when: Date): Promise<string> {
  const day = when.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `RCP-${day}-`;
  const [row] = await tx
    .select({ last: sql<string>`MAX(${boxSettlements.settlementNumber})` })
    .from(boxSettlements)
    .where(sql`${boxSettlements.settlementNumber} LIKE ${prefix + "%"}`);
  const last = String(row?.last ?? "");
  const n = last ? Number(last.slice(prefix.length)) : 0;
  return prefix + String((Number.isFinite(n) ? n : 0) + 1).padStart(4, "0");
}

export interface BoxParcelView {
  /**
   * The box item. The only identity every line has.
   *
   * This was the package id, which quietly cost money: a full-package or
   * commission order scanned into a box carries an order id and no package
   * row, so it disappeared from the settlement and the customer's payment
   * was recorded against nothing.
   */
  lineId: number;
  /** Set when the item is an ordinary parcel. */
  packageId: number | null;
  /** Set when it is a full-package or commission order instead. */
  fullPackageOrderId: number | null;
  trackingNumber: string | null;
  /** The platform order numbers, for the eye only (owner, 2026-09-17). */
  orderNumbers?: string[];
  packageCode: string | null;
  description: string | null;
  /** Number, not the raw decimal string: a per-kilo discount does sums on it. */
  weightKg: number;
  /** The ledger's price for this parcel, corrections included. */
  chargedUsd: number;
  /** Forgiven on earlier settlements. */
  discountedUsd: number;
  /** Paid on earlier settlements. */
  settledUsd: number;
  /** charged − discounted − settled. */
  outstandingUsd: number;
  /**
   * True when the ledger has no charge for this parcel at all — usually
   * because its batch has not been delivered, so nothing has been billed yet.
   * The screen must say so rather than showing a confident zero.
   */
  notChargedYet: boolean;
  /**
   * A commission or full-package order rather than an ordinary parcel. Its
   * money lives on the order: a box receipt never charges it as a parcel.
   */
  fromOrder: boolean;
  /** The advance paid on the order(s), already counted in settledUsd. */
  advanceUsd: number;
}

export interface BoxSettlementView {
  box: {
    id: number;
    boxCode: string;
    status: string;
    deliveryChargeUsd: number;
    batchCode: string | null;
  } | null;
  customer: { id: number; customerCode: string | null; fullName: string | null } | null;
  parcels: BoxParcelView[];
  /** Confirmed and reversed alike, newest first — the box's money history. */
  settlements: Array<BoxSettlement & { staffName: string | null }>;
  /** Pre-fills the rate box so the ordinary day needs no typing. */
  lastExchangeRate: number | null;
  /** What the customer's account stands at now. Negative means credit. */
  accountBalanceUsd: number;
}

type SettlementDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type BoxItemWithPackage = {
  item: typeof deliveryBoxItems.$inferSelect;
  pkg: typeof packages.$inferSelect | null;
};

/**
 * What each item is charged, forgiven, paid and still owes: the payment
 * screen's own sums.
 *
 * Moved out of getBoxSettlementView unchanged, so the box list can ask the
 * same question of many boxes at once (getBoxesPaidInFull) and the list and
 * the screen can never disagree. Every figure is keyed on the item or its
 * package or order, never on the box, so any set of items works. Returns one
 * parcel per item, in the order given.
 */
async function parcelsForItems(db: SettlementDb, items: BoxItemWithPackage[]): Promise<BoxParcelView[]> {
  const packageIds = Array.from(new Set(
    items.map((r) => r.item.packageId).filter((id): id is number => !!id),
  ));

  // Every ledger row that touches these parcels, in one query rather than one
  // per parcel — a box can hold forty.
  /**
   * Every ledger row touching anything in this box, in one query.
   *
   * Both references, because a box holds both kinds. An ordinary parcel is
   * billed as a package; a full-package or commission order is billed in two
   * parts against the order — the goods when it was approved, the freight
   * separately — and reading only the package reference left those items
   * looking free.
   */
  const orderIds = Array.from(new Set(
    items.map((r) => r.item.fullPackageOrderId).filter((id): id is number => !!id),
  ));

  /**
   * Whose account each item is read from: its box's customer, and nobody
   * else's.
   *
   * A reference is not unique across customers. Commission freight is
   * recorded as a package charge under the ORDER's id, and that number can
   * be another customer's parcel — reading by reference alone, a box showed
   * someone else's freight as its own parcel's charge, called it charged,
   * and a payment of that amount "settled" a parcel whose owner had never
   * been billed for it (box-money defect 3, reproduced on a scratch MySQL).
   */
  const boxIds = Array.from(new Set(items.map((r) => Number(r.item.boxId))));
  const owners = boxIds.length
    ? await db
        .select({ boxId: deliveryBoxes.id, accountId: customerAccounts.id, customerId: deliveryBoxes.customerId })
        .from(deliveryBoxes)
        .innerJoin(customerAccounts, eq(customerAccounts.customerId, deliveryBoxes.customerId))
        .where(inArray(deliveryBoxes.id, boxIds))
    : [];
  const accountOfBox = new Map(owners.map((o) => [Number(o.boxId), Number(o.accountId)]));
  const customerOfBox = new Map(owners.map((o) => [Number(o.boxId), Number(o.customerId)]));
  const accountIds = Array.from(new Set(owners.map((o) => Number(o.accountId))));

  const ledgerRows = (accountIds.length && (packageIds.length || orderIds.length))
    ? await db
        .select({
          accountId: ledgerTransactions.accountId,
          referenceType: ledgerTransactions.referenceType,
          referenceId: ledgerTransactions.referenceId,
          transactionType: ledgerTransactions.transactionType,
          amountUsd: ledgerTransactions.amountUsd,
        })
        .from(ledgerTransactions)
        .where(and(
          inArray(ledgerTransactions.accountId, accountIds),
          or(
            packageIds.length
              ? and(
                  eq(ledgerTransactions.referenceType, "package"),
                  inArray(ledgerTransactions.referenceId, packageIds),
                )
              : undefined,
            orderIds.length
              ? and(
                  inArray(ledgerTransactions.referenceType, ["full_package", "commission"]),
                  inArray(ledgerTransactions.referenceId, orderIds),
                )
              : undefined,
          ),
        ))
    : [];

  const charged = new Map<string, number>();
  const discounted = new Map<string, number>();
  const seenAnyCharge = new Set<string>();
  for (const row of ledgerRows) {
    // Keyed by the account and both halves of the reference: package 9 and
    // order 9 are different debts, and one customer's 9 is not another's.
    const id = `${row.accountId}|${row.referenceType}:${row.referenceId}`;
    const amount = Number(row.amountUsd || 0);
    const type = String(row.transactionType);
    if ((CHARGE_TYPES as readonly string[]).includes(type) || type === "ADJUSTMENT_DEBIT") {
      charged.set(id, round2((charged.get(id) ?? 0) + amount));
      seenAnyCharge.add(id);
    } else if (type === "ADJUSTMENT_CREDIT") {
      // A correction downward. It belongs against the price, not in the
      // discount column — the price was wrong, nothing was given away.
      charged.set(id, round2((charged.get(id) ?? 0) - amount));
      seenAnyCharge.add(id);
    } else if (type === "CREDIT_DISCOUNT") {
      discounted.set(id, round2((discounted.get(id) ?? 0) + amount));
    }
  }

  // What earlier settlements already paid. Reversed ones are excluded: their
  // money was handed back out of the ledger and must not still count.
  /**
   * What earlier settlements already paid, per box item.
   *
   * Keyed on the item rather than the package for the same reason everything
   * else here is: a full-package order in a box has no package to key on.
   * Reversed settlements are excluded — their money went back out of the
   * ledger and must not still count as paid.
   */
  const itemIds = items.map((r) => Number(r.item.id));
  const settledRows = itemIds.length
    ? await db
        .select({
          boxItemId: boxSettlementLines.boxItemId,
          paid: sql<string>`SUM(${boxSettlementLines.paidUsd})`,
        })
        .from(boxSettlementLines)
        .innerJoin(boxSettlements, eq(boxSettlements.id, boxSettlementLines.settlementId))
        .where(and(
          inArray(boxSettlementLines.boxItemId, itemIds),
          eq(boxSettlements.status, "confirmed"),
        ))
        .groupBy(boxSettlementLines.boxItemId)
    : [];
  const settledByItem = new Map(settledRows.map((r) => [Number(r.boxItemId), Number(r.paid || 0)]));

  /**
   * Order cartons: a commission or full-package order in the box.
   *
   * Their money lives on the order, not on the parcel they travelled in. A
   * box built from a batch holds the order as that parcel (packageId set,
   * itemType commission / full_package), and keyed on the parcel the screen
   * found no charge — the goods are charged on the order, at entry since
   * 75b3838, and commission freight under the order's id. So it called the
   * carton "not charged yet", priced it from the box, and the receipt charged
   * the goods again (box-money defect 1): a $100 order in two cartons asked
   * for $200 and posted $200 more. Nor did it take off the advance paid on
   * the order, which the printed receipt does (defect 2).
   *
   * So a carton reads its orders — the one named on the item, or this
   * customer's orders on its tracking number, the receipt's own rule — and
   * each order counts once per box, however many cartons it arrived in.
   */
  const orderItems = items.filter((r) => r.item.itemType !== "regular" || !!r.item.fullPackageOrderId);
  const cartonTrackings = Array.from(new Set(
    orderItems
      .filter((r) => !r.item.fullPackageOrderId)
      .map((r) => r.item.trackingNumber ?? r.pkg?.trackingNumber ?? null)
      .filter((t): t is string => !!t),
  ));
  const onTracking: Array<{ orderId: number; trackingNumber: string | null }> = cartonTrackings.length
    ? [
        ...(await db
          .select({ orderId: fullPackageOrderTrackings.fullPackageOrderId, trackingNumber: fullPackageOrderTrackings.trackingNumber })
          .from(fullPackageOrderTrackings)
          .where(inArray(fullPackageOrderTrackings.trackingNumber, cartonTrackings))),
        ...(await db
          .select({ orderId: fullPackageOrders.id, trackingNumber: fullPackageOrders.trackingNumber })
          .from(fullPackageOrders)
          .where(inArray(fullPackageOrders.trackingNumber, cartonTrackings))),
      ]
    : [];
  const cartonOrderIds = Array.from(new Set([...orderIds, ...onTracking.map((r) => Number(r.orderId))]));
  const cartonOrders = cartonOrderIds.length
    ? await db
        .select({
          id: fullPackageOrders.id,
          orderCode: fullPackageOrders.orderCode,
          customerId: fullPackageOrders.customerId,
          orderType: fullPackageOrders.orderType,
          advancePaidUsd: fullPackageOrders.advancePaidUsd,
          paidFromBalanceUsd: fullPackageOrders.paidFromBalanceUsd,
          isPrepaid: fullPackageOrders.isPrepaid,
          deletedAt: fullPackageOrders.deletedAt,
        })
        .from(fullPackageOrders)
        .where(inArray(fullPackageOrders.id, cartonOrderIds))
    : [];
  const orderById = new Map(cartonOrders.map((o) => [Number(o.id), o]));
  const orderRows = cartonOrderIds.length && accountIds.length
    ? await db
        .select({
          accountId: ledgerTransactions.accountId,
          referenceType: ledgerTransactions.referenceType,
          referenceId: ledgerTransactions.referenceId,
          transactionType: ledgerTransactions.transactionType,
          amountUsd: ledgerTransactions.amountUsd,
          description: ledgerTransactions.description,
        })
        .from(ledgerTransactions)
        .where(and(
          inArray(ledgerTransactions.accountId, accountIds),
          inArray(ledgerTransactions.referenceId, cartonOrderIds),
          inArray(ledgerTransactions.referenceType, ["full_package", "commission", "purchase_request", "package"]),
        ))
    : [];
  // Per account and order: the goods, the freight, and their corrections.
  const orderCharged = new Map<string, number>();
  const orderSeen = new Set<string>();
  for (const row of orderRows) {
    const order = orderById.get(Number(row.referenceId));
    if (!order) continue;
    // Freight sits under the order's id as a package charge; only a row that
    // names the order is its freight — a parcel with the same number is not.
    if (row.referenceType === "package" && !String(row.description ?? "").includes(order.orderCode)) continue;
    const type = String(row.transactionType);
    const sign = (CHARGE_TYPES as readonly string[]).includes(type) || type === "ADJUSTMENT_DEBIT"
      ? 1
      : type === "ADJUSTMENT_CREDIT" ? -1 : 0;
    if (sign === 0) continue;
    const id = `${row.accountId}|${order.id}`;
    orderCharged.set(id, round2((orderCharged.get(id) ?? 0) + sign * Number(row.amountUsd || 0)));
    orderSeen.add(id);
  }
  const claimedInBox = new Set<string>();

  const parcels: BoxParcelView[] = items
    .map((r) => {
      const packageId = r.item.packageId ? Number(r.item.packageId) : null;
      const orderId = r.item.fullPackageOrderId ? Number(r.item.fullPackageOrderId) : null;
      const account = accountOfBox.get(Number(r.item.boxId)) ?? "none";
      const key = packageId !== null
        ? `${account}|package:${packageId}`
        : orderId !== null
          ? [`${account}|full_package:${orderId}`, `${account}|commission:${orderId}`].find((k) => charged.has(k)) ?? `${account}|full_package:${orderId}`
          : "";
      const fromLedger = charged.get(key);

      const boxId = Number(r.item.boxId);
      const fromOrder = r.item.itemType !== "regular" || orderId !== null;
      let orderMoney: { chargedUsd: number; advanceUsd: number; onAccount: boolean } | null = null;
      if (fromOrder) {
        const tracking = r.item.trackingNumber ?? r.pkg?.trackingNumber ?? null;
        const candidates = orderId !== null
          ? [orderId]
          : Array.from(new Set(onTracking.filter((t) => tracking && t.trackingNumber === tracking).map((t) => Number(t.orderId))));
        const mine = candidates
          .map((id) => orderById.get(id))
          .filter((o): o is NonNullable<typeof o> =>
            !!o && Number(o.customerId) === customerOfBox.get(boxId) && (orderId !== null || !o.deletedAt));
        if (mine.length > 0) {
          let chargedCents = 0;
          let advanceCents = 0;
          let onAccount = false;
          for (const o of mine) {
            const id = `${account}|${o.id}`;
            if (orderSeen.has(id)) onAccount = true;
            // Once per box: the second carton of an order owes nothing more.
            const claim = `${boxId}|${o.id}`;
            if (claimedInBox.has(claim)) continue;
            claimedInBox.add(claim);
            chargedCents += Math.round((orderCharged.get(id) ?? 0) * 100);
            advanceCents += Math.round(orderAdvancePaidUsd(o as unknown as AdvanceSource) * 100);
          }
          orderMoney = { chargedUsd: chargedCents / 100, advanceUsd: advanceCents / 100, onAccount };
        }
      }
      /**
       * The parcel's own price, when the ledger has not been told about it.
       *
       * Charges are posted at batch delivery. A box can be made, sealed and
       * handed over before that ever runs — and once there is a box, the
       * goods have gone to the customer, so the money is collectable now.
       * The box item carries the price it was built with; showing $0.00 next
       * to a customer holding $629 of goods is the screen being wrong, not
       * the box being free.
       */
      const chargedUsd = round2(
        orderMoney
          ? (orderMoney.onAccount ? orderMoney.chargedUsd : Number(r.item.calculatedCostUsd || 0))
          : fromLedger !== undefined ? fromLedger : Number(r.item.calculatedCostUsd || 0),
      );
      const discountedUsd = round2(discounted.get(key) ?? 0);
      const advanceUsd = round2(orderMoney?.advanceUsd ?? 0);
      // An advance is money already paid for these goods, so it counts as paid.
      const settledUsd = round2((settledByItem.get(Number(r.item.id)) ?? 0) + advanceUsd);
      return {
        lineId: Number(r.item.id),
        packageId,
        fullPackageOrderId: orderId,
        trackingNumber: r.item.trackingNumber ?? r.pkg?.trackingNumber ?? null,
        packageCode: r.item.packageCode ?? r.pkg?.packageCode ?? null,
        description: r.item.description ?? null,
        weightKg: Number(r.item.weightKg ?? r.pkg?.weightKg ?? 0) || 0,
        chargedUsd,
        discountedUsd,
        settledUsd,
        outstandingUsd: round2(chargedUsd - discountedUsd - settledUsd),
        /**
         * True when nothing has been posted to the customer's account for
         * this parcel yet. Not a refusal — settling posts the charge and the
         * payment together, which is what actually happened.
         */
        notChargedYet: orderMoney ? !orderMoney.onAccount : !seenAnyCharge.has(key),
        fromOrder,
        advanceUsd,
      };
    });

  return parcels;
}

/**
 * Which of these boxes the payment screen would call paid in full.
 *
 * The screen's own sums (parcelsForItems) for many boxes in three queries,
 * and finishPaidBox's own test: a box with parcels, a confirmed payment on
 * record, and nothing outstanding on any parcel. The box list archives what
 * this returns, so a box the screen says is paid never stays in the list.
 */
export async function getBoxesPaidInFull(boxIds: number[]): Promise<Set<number>> {
  const paid = new Set<number>();
  const ids = Array.from(new Set(boxIds.map(Number))).filter((id) => id > 0);
  if (ids.length === 0) return paid;
  const db = await getDb();
  if (!db) return paid;

  const withPayment = await db
    .selectDistinct({ boxId: boxSettlements.boxId })
    .from(boxSettlements)
    .where(and(inArray(boxSettlements.boxId, ids), eq(boxSettlements.status, "confirmed")));
  const payingIds = withPayment.map((r) => Number(r.boxId));
  if (payingIds.length === 0) return paid;

  const items = await db
    .select({ item: deliveryBoxItems, pkg: packages })
    .from(deliveryBoxItems)
    .leftJoin(packages, eq(packages.id, deliveryBoxItems.packageId))
    .where(inArray(deliveryBoxItems.boxId, payingIds));
  const parcels = await parcelsForItems(db, items);

  const byBox = new Map<number, BoxParcelView[]>();
  items.forEach((r, i) => {
    const boxId = Number(r.item.boxId);
    const list = byBox.get(boxId) ?? [];
    list.push(parcels[i]);
    byBox.set(boxId, list);
  });
  byBox.forEach((lines, boxId) => {
    // Word for word the test finishPaidBox uses (server/lib/boxLifecycle.ts).
    const paidInFull = lines.length > 0 && lines.every((p) => Number(p.outstandingUsd) <= SETTLED_SLACK_USD);
    if (paidInFull) paid.add(boxId);
  });
  return paid;
}

/**
 * Has this parcel already been paid for, in some other box?
 *
 * The owner's rule (Sep 2026): once a box's money is in, nothing inside it
 * may be charged again somewhere else. The scanner's existing guard only
 * looks at boxes that are still open, ready or in transit — and a paid box
 * is neither: `finishPaidBox` seals it and marks it delivered. So the one
 * carton a customer has already paid for was the one the scanner would
 * happily put in a second box and bill a second time.
 *
 * Matched three ways because one carton can be reached by three names: the
 * parcel row, a full-package/commission order, and the tracking number
 * itself — which is what a shared carton's sibling orders have in common.
 *
 * Returns the box to name in the refusal, or null when nothing is paid.
 * Cancelled boxes are ignored; so is the box being scanned into.
 */
export async function findPaidBoxHolding(opts: {
  packageId?: number | null;
  fullPackageOrderId?: number | null;
  trackingNumber?: string | null;
  exceptBoxId?: number | null;
}): Promise<{ boxId: number; boxCode: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const identities = [
    opts.packageId ? eq(deliveryBoxItems.packageId, opts.packageId) : null,
    opts.fullPackageOrderId ? eq(deliveryBoxItems.fullPackageOrderId, opts.fullPackageOrderId) : null,
    opts.trackingNumber ? eq(deliveryBoxItems.trackingNumber, opts.trackingNumber) : null,
  ].filter(Boolean);
  if (identities.length === 0) return null;

  const rows = await db
    .select({ boxId: deliveryBoxItems.boxId, boxCode: deliveryBoxes.boxCode })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxItems.boxId, deliveryBoxes.id))
    .where(and(
      or(...(identities as any[])),
      sql`${deliveryBoxes.status} <> 'cancelled'`,
    ));

  const candidates = rows.filter((r) => Number(r.boxId) !== Number(opts.exceptBoxId ?? 0));
  if (candidates.length === 0) return null;

  const paid = await getBoxesPaidInFull(candidates.map((r) => Number(r.boxId)));
  const hit = candidates.find((r) => paid.has(Number(r.boxId)));
  return hit ? { boxId: Number(hit.boxId), boxCode: hit.boxCode } : null;
}

/**
 * Everything the settlement screen needs, in one call.
 *
 * Deliberately one call: the screen opens at a counter with a customer
 * standing at it, and four round trips to fill in one table is four chances
 * to show half a number.
 */
/**
 * The rate the most recent payment used, and when. Offered on the payment
 * screen and on the window before a receipt is printed. Read-only.
 */
export async function getLastSettlementRate(): Promise<{ rate: number; at: Date } | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ rate: boxSettlements.exchangeRate, at: boxSettlements.createdAt })
    .from(boxSettlements)
    .where(sql`${boxSettlements.exchangeRate} IS NOT NULL AND ${boxSettlements.exchangeRate} > 0`)
    .orderBy(desc(boxSettlements.createdAt))
    .limit(1);
  return row?.rate ? { rate: Number(row.rate), at: row.at } : null;
}

export async function getBoxSettlementView(boxId: number): Promise<BoxSettlementView> {
  const empty: BoxSettlementView = {
    box: null, customer: null, parcels: [], settlements: [],
    lastExchangeRate: null, accountBalanceUsd: 0,
  };
  const db = await getDb();
  if (!db) return empty;

  const [boxRow] = await db
    .select({ box: deliveryBoxes, batchCode: batches.batchCode, customer: customers })
    .from(deliveryBoxes)
    .leftJoin(batches, eq(batches.id, deliveryBoxes.batchId))
    .leftJoin(customers, eq(customers.id, deliveryBoxes.customerId))
    .where(eq(deliveryBoxes.id, boxId))
    .limit(1);
  if (!boxRow?.box) return empty;

  const items = await db
    .select({ item: deliveryBoxItems, pkg: packages })
    .from(deliveryBoxItems)
    .leftJoin(packages, eq(packages.id, deliveryBoxItems.packageId))
    .where(eq(deliveryBoxItems.boxId, boxId))
    .orderBy(deliveryBoxItems.scannedAt);

  const parcels = await parcelsForItems(db, items);

  const history = await db
    .select({ s: boxSettlements, staffName: users.name })
    .from(boxSettlements)
    .leftJoin(users, eq(users.id, boxSettlements.createdById))
    .where(eq(boxSettlements.boxId, boxId))
    .orderBy(desc(boxSettlements.createdAt));

  const [account] = await db
    .select({ balance: customerAccounts.currentBalanceUsd })
    .from(customerAccounts)
    .where(eq(customerAccounts.customerId, boxRow.box.customerId))
    .limit(1);

  // The rate the last settlement used, so the ordinary day needs no typing.
  // The dollar sits still for a week at a time here.
  const lastRate = await getLastSettlementRate();

  return {
    box: {
      id: boxRow.box.id,
      boxCode: boxRow.box.boxCode,
      status: String(boxRow.box.status),
      deliveryChargeUsd: Number(boxRow.box.deliveryChargeUsd || 0),
      batchCode: boxRow.batchCode ?? null,
    },
    customer: boxRow.customer
      ? {
          id: boxRow.customer.id,
          customerCode: boxRow.customer.customerCode,
          fullName: boxRow.customer.fullName,
        }
      : null,
    parcels: await withParcelOrderNumbers(parcels),
    settlements: history.map((h) => ({ ...h.s, staffName: h.staffName ?? null })),
    lastExchangeRate: lastRate?.rate ?? null,
    accountBalanceUsd: Number(account?.balance ?? 0),
  };
}

export interface SettlementLineInput {
  /** The box item, from the view. Not the package: some items have none. */
  lineId: number;
  held?: boolean;
  heldReason?: string;
  correctionUsd?: number;
  correctionReason?: string;
  discountUsd?: number;
  discountReason?: DiscountReason;
  discountNote?: string;
}

export interface CreateSettlementInput {
  boxId: number;
  lines: SettlementLineInput[];
  /**
   * A discount on the box as a whole — "make it 880", or "call the kilo ten
   * instead of eleven". This is how one is usually given; the per-line
   * discount above is for the parcel that arrived broken.
   *
   * It is split across the parcels before anything else happens, so the
   * receipt, the ledger and the discount report all see the same money.
   */
  boxDiscount?: BoxDiscount;
  boxDiscountReason?: DiscountReason;
  boxDiscountNote?: string;
  /** Dinars actually taken. Zero when the customer paid in dollars. */
  amountIqd?: number;
  /** The dollar rate used that day. Required whenever dinars are taken. */
  exchangeRate?: number;
  /** Dollars taken directly, if any. */
  amountUsd?: number;
  /** What to do with a shortfall: keep it owed, or write it off. */
  treatShortAs?: "debt" | "discount";
  differenceReason?: string;
  paymentMethod?: "CASH" | "BANK_TRANSFER" | "FIB" | "FASTPAY" | "ZAINCASH" | "ASIAHAWALA" | "CARD" | "OTHER";
  notes?: string;
  /** Set when this settlement replaces one being corrected. */
  replacesSettlementId?: number;
}

/**
 * Take the money.
 *
 * One transaction from end to end. A payment that committed while the receipt
 * rows failed would leave money on a customer's account with nothing saying
 * what it was for — which on this screen is indistinguishable from the money
 * having been taken twice.
 *
 * The order matters as much as the atomicity: corrections are applied to the
 * ledger first, because they change what is owed, and only then is the total
 * recomputed and paid. Doing it the other way round would settle against a
 * price that was already known to be wrong.
 */
export async function createBoxSettlement(
  input: CreateSettlementInput,
  userId: number,
): Promise<{ settlementId: number; settlementNumber: string; paidUsd: number; differenceKind: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const view = await getBoxSettlementView(input.boxId);
  const box = view.box;
  const customer = view.customer;
  if (!box) throw new Error("بۆکس نەدۆزرایەوە");
  if (!customer) throw new Error("کڕیاری بۆکس نەدۆزرایەوە");

  const requested = new Set(input.lines.map((l) => l.lineId));
  const parcels = view.parcels.filter((p) => requested.has(p.lineId));
  if (parcels.length === 0) throw new Error("هیچ پارسێلێک هەڵنەبژێردراوە");

  /**
   * Parcels the customer's account has never been told about.
   *
   * This used to be a refusal, and it was wrong: a box exists because the
   * goods went to the customer, and the owner settles when they decide to —
   * straight away, or when the courier gets back. The charge simply had not
   * been posted yet, because that happens at batch delivery.
   *
   * So it is posted here instead, from the price the box was built with, in
   * the same transaction as the payment that clears it. Both sides of what
   * actually happened, recorded together. Held parcels are left alone: they
   * are not being paid for, so there is nothing to charge for.
   */
  /**
   * Only an ordinary parcel can be charged from here.
   *
   * A full-package or commission order carries its money on the order and is
   * charged by the order flow; posting a package charge for it would be a
   * second bill for the same goods. Its line is still settled — the payment
   * is recorded against it — which is the part that was missing.
   */
  const settling = (p: BoxParcelView) =>
    !input.lines.find((l) => l.lineId === p.lineId)?.held && p.chargedUsd > 0;

  const toCharge = parcels.filter((p) => p.packageId !== null && !p.fromOrder && p.notChargedYet && settling(p));

  /** Parcels deliberately left off this receipt; nothing is forgiven on them. */
  const held = input.lines.filter((l) => l.held).map((l) => l.lineId);

  /**
   * Orders are never charged from here.
   *
   * A full-package or commission order is billed in two parts, and the
   * system already knows it: the goods at the moment the order is approved
   * (`isCharged`), and the freight separately (`isShippingCharged`). The box
   * item's own `calculatedCostUsd` is the goods price — a copy of what the
   * ledger already holds — so posting it here would bill the customer twice
   * for the same things.
   *
   * What the settlement does for an order is settle it: read what the ledger
   * says is outstanding, and record the payment against it.
   */

  const boxCut = input.boxDiscount ? boxDiscountUsd(input.boxDiscount, parcels) : 0;
  if (boxCut > 0 && !input.boxDiscountReason) {
    throw new Error("هۆکاری داشکاندن پێویستە — بەبێ ئەو، ڕاپۆرتی داشکاندن بێ واتایە");
  }
  const boxCutByParcel = allocateBoxDiscount(boxCut, parcels, held);

  const intents: ParcelIntent[] = input.lines.map((l) => ({
    lineId: l.lineId,
    held: l.held,
    correctionUsd: l.correctionUsd,
    discountUsd: round2((l.discountUsd ?? 0) + (boxCutByParcel.get(l.lineId) ?? 0)),
  }));
  const totals = settlementTotals(parcels, intents);

  const rate = Number(input.exchangeRate ?? 0);
  const iqd = Number(input.amountIqd ?? 0);
  if (iqd > 0 && !(rate > 0)) {
    throw new Error("نرخی دۆلار پێویستە کاتێک پارە بە دینار وەردەگیرێت");
  }
  const fromIqd = iqd > 0 && rate > 0 ? round2(iqd / rate) : 0;
  const paidUsd = round2(fromIqd + Number(input.amountUsd ?? 0));

  const difference = differenceOf(totals.dueUsd, paidUsd, input.treatShortAs ?? "debt");
  if (difference.reasonRequired && !(input.differenceReason ?? "").trim()) {
    throw new Error("هۆکار پێویستە بۆ ئەو جیاوازییەی نێوان پارەی پێویست و پارەی وەرگیراو");
  }
  for (const line of input.lines) {
    if ((line.discountUsd ?? 0) > 0 && !line.discountReason) {
      throw new Error("هۆکاری داشکاندن پێویستە — بەبێ ئەو، ڕاپۆرتی داشکاندن بێ واتایە");
    }
    if ((line.correctionUsd ?? 0) !== 0 && !(line.correctionReason ?? "").trim()) {
      throw new Error("هۆکاری ڕاستکردنەوەی نرخ پێویستە");
    }
  }

  const now = new Date();

  return await db.transaction(async (tx) => {
    // 0. Charge what was never charged. Before the corrections, because a
    //    correction adjusts a charge and there has to be one to adjust.
    for (const parcel of toCharge) {
      await recordPackageChargeWithoutInvoice(
        customer.id,
        customer.customerCode ?? String(customer.id),
        parcel.packageId!,
        parcel.chargedUsd,
        `${box.boxCode} — ${parcel.trackingNumber ?? parcel.packageCode ?? ""}`.trim(),
        userId,
        undefined,
        tx,
      );
      // The flag every other charging path checks, so this parcel cannot be
      // charged a second time when its batch is eventually marked delivered.
      await tx.update(packages).set({ isCharged: true }).where(eq(packages.id, parcel.packageId!));
    }
    // And the other flag, on the other path. Batch delivery charges plain
    // packages and full-package orders separately, guarded separately; the
    // line above stops one of them and this stops the other.
    if (toCharge.length > 0) {
      await markLinkedOrdersCharged(toCharge.map((p) => p.packageId!), tx);
    }

    // 1. Corrections change the price, so they go in before anything is paid.
    for (const line of input.lines) {
      const delta = Number(line.correctionUsd ?? 0);
      if (delta === 0) continue;
      const parcel = parcels.find((p) => p.lineId === line.lineId);
      if (!parcel) continue;
      // An order's price is corrected on the order, where its charge lives.
      // Skipping it quietly would print a corrected receipt over an
      // uncorrected account.
      if (parcel.fromOrder) {
        throw new Error(`نرخی ${parcel.trackingNumber ?? parcel.packageCode ?? parcel.lineId} لەسەر ئۆردەرەکەیەتی — لە ئۆردەرەکەوە ڕاستی بکەرەوە، نەک لە وەسڵی بۆکس`);
      }
      // Only an ordinary parcel has a ledger charge to adjust.
      if (parcel.packageId === null) continue;
      const [chargeTxn] = await tx
        .select({ id: ledgerTransactions.id })
        .from(ledgerTransactions)
        .where(and(
          eq(ledgerTransactions.referenceType, "package"),
          eq(ledgerTransactions.referenceId, parcel.packageId),
          inArray(ledgerTransactions.transactionType, [...CHARGE_TYPES]),
        ))
        .orderBy(desc(ledgerTransactions.id))
        .limit(1);
      if (!chargeTxn) {
        throw new Error(`ناتوانرێت نرخی پارسێلی ${parcel.packageCode ?? parcel.lineId} ڕاست بکرێتەوە — بارکردنی سەرەکی نەدۆزرایەوە`);
      }
      await adjustCharge(
        chargeTxn.id,
        round2(Math.max(0, parcel.chargedUsd + delta)),
        line.correctionReason!.trim(),
        userId,
        tx,
      );
    }

    // 2. Discounts are credits against the parcel, so the balance drops with
    //    the receipt rather than at some later reconciliation.
    const discountTotal = round2(
      totals.lines.reduce((sum, l) => sum + l.discountUsd, 0) +
      (difference.kind === "discount" ? difference.amountUsd : 0),
    );
    if (discountTotal > 0) {
      await postDiscountCredits(tx, {
        customerId: customer.id,
        // A discount credit is posted against the parcel it forgave, so the
        // report can add it up by batch and by code. An item with no parcel —
        // a full-package order — has its discount recorded on the settlement
        // line and credited to the account without a parcel reference.
        lines: totals.lines
          .filter((l) => l.discountUsd > 0)
          .map((l) => ({
            packageId: parcels.find((p) => p.lineId === l.lineId)?.packageId ?? null,
            discountUsd: l.discountUsd,
          })),
        extraUsd: difference.kind === "discount" ? difference.amountUsd : 0,
        reason: input.differenceReason ?? "",
        userId,
      });
    }

    // 3. The money itself, through the one function that already knows how to
    //    move a customer's balance and write a payment record.
    let ledgerTransactionId: number | null = null;
    let paymentRecordId: number | null = null;
    if (paidUsd > 0) {
      const result = await recordPaymentReceived(
        customer.id,
        customer.customerCode ?? String(customer.id),
        paidUsd,
        0,
        input.paymentMethod ?? "CASH",
        userId,
        `${box.boxCode}${input.notes ? " — " + input.notes : ""}`,
        undefined,
        undefined,
        undefined,
        tx,
      );
      ledgerTransactionId = result.transaction.id;
      paymentRecordId = result.payment.id;
    }

    const settlementNumber = await nextSettlementNumber(tx, now);
    const inserted = await tx.insert(boxSettlements).values({
      boxId: input.boxId,
      customerId: customer.id,
      settlementNumber,
      dueUsd: totals.dueUsd.toFixed(2),
      paidUsd: paidUsd.toFixed(2),
      discountUsd: discountTotal.toFixed(2),
      amountIqd: String(Math.round(iqd)),
      exchangeRate: rate > 0 ? rate.toFixed(2) : null,
      differenceUsd: difference.amountUsd.toFixed(2),
      differenceKind: difference.kind,
      differenceReason: input.differenceReason ?? null,
      paymentMethod: input.paymentMethod ?? "CASH",
      ledgerTransactionId,
      paymentRecordId,
      notes: input.notes ?? null,
      replacesSettlementId: input.replacesSettlementId ?? null,
      createdById: userId,
      createdAt: now,
    });
    const settlementId = Number(inserted[0].insertId);

    for (const line of totals.lines) {
      const source = input.lines.find((l) => l.lineId === line.lineId);
      const parcel = parcels.find((p) => p.lineId === line.lineId);
      await tx.insert(boxSettlementLines).values({
        settlementId,
        boxItemId: line.lineId,
        packageId: parcel?.packageId ?? null,
        fullPackageOrderId: parcel?.fullPackageOrderId ?? null,
        chargedUsd: line.chargedUsd.toFixed(2),
        correctionUsd: line.correctionUsd.toFixed(2),
        correctionReason: source?.correctionReason ?? null,
        discountUsd: line.discountUsd.toFixed(2),
        discountReason: line.discountUsd > 0
          ? (source?.discountReason ?? input.boxDiscountReason ?? "other")
          : null,
        discountNote: source?.discountNote ?? input.boxDiscountNote ?? null,
        paidUsd: line.paidUsd.toFixed(2),
        isHeld: line.held,
        heldReason: line.held ? (source?.heldReason ?? null) : null,
      });
    }

    return { settlementId, settlementNumber, paidUsd, differenceKind: difference.kind, discountTotal };
  }).then(async (result) => {
    /**
     * Tell the customer their money arrived.
     *
     * The system tells them when a parcel is scanned. It said nothing at all
     * when the company took their money — the single most important thing
     * that happens to them here. Their balance simply changed, on a screen
     * they might open a week later, with nothing to say why.
     *
     * Outside the transaction on purpose. The money is committed by this
     * point and a notification that fails must never roll it back; the worst
     * case is a customer who was not told, which is exactly where this
     * started and is survivable.
     */
    try {
      const short = result.differenceKind === "debt" ? difference.amountUsd : 0;
      const settledInFull = short <= 0;

      /**
       * Two different pieces of news, so two different messages.
       *
       * Paid in full is the good day, and it should read like one — a thank
       * you, in plain words, with the numbers a customer might want to check
       * kept short. Every customer has to be able to read this: not all of
       * them are comfortable with paperwork, and a sentence full of receipt
       * numbers and decimals is one they will not finish.
       *
       * Money still owed is the other kind, and it says the one number that
       * matters and nothing else. No jargon either way.
       */
      await createCustomerNotification({
        customerId: customer.id,
        type: "payment",
        relatedType: "payment",
        relatedId: result.settlementId,
        title: settledInFull ? "سوپاس — پارەکەت وەرگیرا" : "بەشێکی پارەکەت وەرگیرا",
        message: settledInFull
          ? `دەست خۆش. پارەی بۆکسی ${box.boxCode} بە تەواوی وەرگیرا — $${result.paidUsd.toFixed(2)}.` +
            (result.discountTotal > 0
              ? ` داشکاندنی $${result.discountTotal.toFixed(2)}ت بۆ کرا.`
              : "")
          : `$${result.paidUsd.toFixed(2)}ت دا بۆ بۆکسی ${box.boxCode}. $${short.toFixed(2)} ماوە.`,
      });
    } catch (err) {
      appLogger.error("[BoxSettlement] customer notification failed", {
        settlementId: result.settlementId, err,
      });
    }

    /**
     * And on WhatsApp, where people here actually read things.
     *
     * The portal notice above reaches somebody who opens the portal. This
     * reaches everybody else, which for money is the difference between a
     * customer who knows their payment was recorded and one who telephones
     * to ask.
     *
     * Silent unless the company switched it on and the customer opted in,
     * and never awaited: the money is committed, and Meta's reply time is
     * nobody's problem but its own.
     */
    notifyPaymentReceived(customer.id, result.paidUsd, box.boxCode).catch(() => {});

    return result;
  });
}

/**
 * One CREDIT_DISCOUNT per parcel, referenced to that parcel.
 *
 * One row for the whole box would be simpler and would ruin the report the
 * owner actually asked for: "how much did we discount on this batch, to this
 * customer code, for breakage" is only answerable if each discount still
 * knows which parcel it belongs to.
 */
async function postDiscountCredits(
  tx: any,
  args: {
    customerId: number;
    lines: Array<{ packageId: number | null; discountUsd: number }>;
    extraUsd: number;
    reason: string;
    userId: number;
  },
): Promise<void> {
  const [account] = await tx
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.customerId, args.customerId))
    .for("update")
    .limit(1);
  if (!account) throw new Error("حیسابی کڕیار نەدۆزرایەوە");

  let balance = Number(account.currentBalanceUsd || 0);
  const balanceIqd = Number(account.currentBalanceIqd || 0);

  const entries = [
    ...args.lines.map((l) => ({ packageId: l.packageId as number | null, amount: l.discountUsd })),
    // The rounding or shortfall written off at the box, which belongs to no
    // single parcel.
    ...(args.extraUsd > 0 ? [{ packageId: null, amount: args.extraUsd }] : []),
  ];

  for (const entry of entries) {
    if (!(entry.amount > 0)) continue;
    const before = balance;
    balance = round2(balance - entry.amount);
    await tx.insert(ledgerTransactions).values({
      accountId: account.id,
      transactionNumber: generateTransactionNumber(),
      transactionType: "CREDIT_DISCOUNT",
      amountUsd: entry.amount.toFixed(2),
      amountIqd: "0",
      balanceBeforeUsd: before.toFixed(2),
      balanceAfterUsd: balance.toFixed(2),
      balanceBeforeIqd: balanceIqd.toFixed(0),
      balanceAfterIqd: balanceIqd.toFixed(0),
      referenceType: entry.packageId ? "package" : "adjustment",
      referenceId: entry.packageId,
      description: args.reason || "داشکاندن لە کاتی واصڵکردنی بۆکس",
      createdById: args.userId,
    });
  }

  await tx
    .update(customerAccounts)
    .set({ currentBalanceUsd: balance.toFixed(2), lastTransactionAt: new Date() })
    .where(eq(customerAccounts.id, account.id));
}

/**
 * Undo a settlement, without pretending it never happened.
 *
 * Numbers do have to be correctable after the money is in — somebody typed
 * 45,000 for 54,000. But the receipt is already in a customer's hand, so the
 * row underneath it is not edited: it stays, marked reversed, with the reason
 * it was wrong, and a corrected settlement is written beside it pointing back.
 *
 * Both are readable afterwards, in order, which is the only way anyone can
 * later see what actually happened at that counter.
 */
export async function reverseBoxSettlement(
  settlementId: number,
  reason: string,
  userId: number,
): Promise<{ ok: true }> {
  if (!reason || reason.trim().length < 3) {
    throw new Error("هۆکاری هەڵوەشاندنەوە پێویستە");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    const [settlement] = await tx
      .select()
      .from(boxSettlements)
      .where(eq(boxSettlements.id, settlementId))
      .limit(1);
    if (!settlement) throw new Error("واصڵ نەدۆزرایەوە");
    if (settlement.status === "reversed") throw new Error("ئەم واصڵە پێشتر هەڵوەشێنراوەتەوە");

    const [account] = await tx
      .select()
      .from(customerAccounts)
      .where(eq(customerAccounts.customerId, settlement.customerId))
      .for("update")
      .limit(1);
    if (!account) throw new Error("حیسابی کڕیار نەدۆزرایەوە");

    /**
     * The payment record this settlement wrote.
     *
     * Undoing the receipt used to leave it untouched, so everything that
     * reads payment records — the portal's "total paid", the revenue and
     * payment reports — went on counting money that had been handed back.
     * And an accountant could undo the same payment a second time from the
     * payments list, raising the customer's balance twice for one mistake.
     *
     * If part of it was already undone from that list, only the rest is put
     * back here: a payment is reversed once, whichever screen does it.
     */
    const [record] = settlement.paymentRecordId
      ? await tx
          .select()
          .from(paymentRecords)
          .where(eq(paymentRecords.id, settlement.paymentRecordId))
          .for("update")
          .limit(1)
      : [];
    const paid = Number(settlement.paidUsd || 0);
    const alreadyReversed = record ? Math.min(paid, Number(record.reversedAmountUsd || 0)) : 0;

    // Put back everything this settlement took off the balance — the payment
    // and any discount alike. Both left the customer owing less; undoing one
    // and not the other would leave the account quietly wrong.
    const putBack = round2(paid - alreadyReversed + Number(settlement.discountUsd || 0));
    let reversalTransactionId: number | null = null;
    if (putBack > 0) {
      const before = Number(account.currentBalanceUsd || 0);
      const after = round2(before + putBack);
      const balanceIqd = Number(account.currentBalanceIqd || 0);
      const insertedReversal = await tx.insert(ledgerTransactions).values({
        accountId: account.id,
        transactionNumber: generateTransactionNumber(),
        transactionType: "ADJUSTMENT_DEBIT",
        amountUsd: putBack.toFixed(2),
        amountIqd: "0",
        balanceBeforeUsd: before.toFixed(2),
        balanceAfterUsd: after.toFixed(2),
        balanceBeforeIqd: balanceIqd.toFixed(0),
        balanceAfterIqd: balanceIqd.toFixed(0),
        referenceType: "adjustment",
        description: `هەڵوەشاندنەوەی واصڵی ${settlement.settlementNumber} — ${reason.trim()}`,
        createdById: userId,
      });
      reversalTransactionId = Number(insertedReversal[0].insertId);
      await tx
        .update(customerAccounts)
        .set({ currentBalanceUsd: after.toFixed(2), lastTransactionAt: new Date() })
        .where(eq(customerAccounts.id, account.id));
    }

    if (record && paid > alreadyReversed) {
      const original = Number(record.amountUsd || 0);
      const reversedNow = round2(Math.min(original, Number(record.reversedAmountUsd || 0) + (paid - alreadyReversed)));
      const whole = reversedNow >= original - 0.005;
      await tx
        .update(paymentRecords)
        .set({
          reversedAmountUsd: reversedNow.toFixed(2),
          reversedAt: new Date(),
          reversalTransactionId: reversalTransactionId ?? record.reversalTransactionId,
          paymentStatus: whole ? "refunded" : record.paymentStatus,
          cancelledAt: whole ? new Date() : record.cancelledAt,
          cancelledById: whole ? userId : record.cancelledById,
          cancelReason: whole ? `هەڵوەشاندنەوەی واصڵی ${settlement.settlementNumber} — ${reason.trim()}` : record.cancelReason,
        })
        .where(eq(paymentRecords.id, record.id));
    }

    await tx
      .update(boxSettlements)
      .set({
        status: "reversed",
        reversedAt: new Date(),
        reversedById: userId,
        reversalReason: reason.trim(),
      })
      .where(eq(boxSettlements.id, settlementId));

    /**
     * And when it is undone. This one matters more than the payment: the
     * customer's balance goes back UP, and a debt reappearing with nothing
     * to explain it is how somebody decides the company is cheating them.
     */
    try {
      await createCustomerNotification({
        customerId: settlement.customerId,
        type: "payment",
        relatedType: "payment",
        relatedId: settlementId,
        title: "پارەیەک گەڕایەوە سەر حیسابەکەت",
        // Plain words, and the reason first: the customer's balance has just
        // gone up and the only question they have is why.
        message: `$${putBack.toFixed(2)} گەڕایەوە سەر حیسابەکەت. هۆکار: ${reason.trim()}`,
      });
    } catch (err) {
      appLogger.error("[BoxSettlement] reversal notification failed", { settlementId, err });
    }

    appLogger.info("[BoxSettlement] reversed", { settlementId, putBack, userId });
    return { ok: true as const };
  });
}

export interface DiscountReportRow {
  reason: string;
  totalUsd: number;
  count: number;
}

export interface DiscountReport {
  totalUsd: number;
  count: number;
  byReason: DiscountReportRow[];
  byMonth: Array<{ ym: string; totalUsd: number; count: number }>;
  byCustomer: Array<{ customerId: number; customerCode: string | null; totalUsd: number; count: number }>;
  byBatch: Array<{ batchId: number | null; batchCode: string | null; totalUsd: number; count: number }>;
}

/**
 * How much has been given away, and on what grounds.
 *
 * Every cut is a line with a reason attached to a parcel, and a parcel knows
 * its batch and its customer — so month, batch, code and reason are four
 * readings of the same rows rather than four things to record.
 *
 * Reversed settlements are excluded throughout: a discount that was undone
 * was not a discount.
 */
export async function getDiscountReport(
  startDate?: Date,
  endDate?: Date,
): Promise<DiscountReport> {
  const empty: DiscountReport = {
    totalUsd: 0, count: 0, byReason: [], byMonth: [], byCustomer: [], byBatch: [],
  };
  const db = await getDb();
  if (!db) return empty;

  try {
    const where = and(
      eq(boxSettlements.status, "confirmed"),
      sql`${boxSettlementLines.discountUsd} > 0`,
      ...(startDate ? [gte(boxSettlements.createdAt, startDate)] : []),
      ...(endDate ? [lte(boxSettlements.createdAt, endDate)] : []),
    );

    const rows = await db
      .select({
        discountUsd: boxSettlementLines.discountUsd,
        reason: boxSettlementLines.discountReason,
        createdAt: boxSettlements.createdAt,
        customerId: boxSettlements.customerId,
        customerCode: customers.customerCode,
        batchId: packages.batchId,
        batchCode: batches.batchCode,
      })
      .from(boxSettlementLines)
      .innerJoin(boxSettlements, eq(boxSettlements.id, boxSettlementLines.settlementId))
      .leftJoin(customers, eq(customers.id, boxSettlements.customerId))
      .leftJoin(packages, eq(packages.id, boxSettlementLines.packageId))
      .leftJoin(batches, eq(batches.id, packages.batchId))
      .where(where);

    // Grouped in memory rather than in four queries: a discount row is one
    // per forgiven parcel, so even a busy year is a small list.
    const bucket = <K>(key: (r: (typeof rows)[number]) => K) => {
      const map = new Map<string, { key: K; totalUsd: number; count: number }>();
      for (const r of rows) {
        const k = key(r);
        const id = JSON.stringify(k);
        const acc = map.get(id) ?? { key: k, totalUsd: 0, count: 0 };
        acc.totalUsd = round2(acc.totalUsd + Number(r.discountUsd || 0));
        acc.count += 1;
        map.set(id, acc);
      }
      return Array.from(map.values()).sort((a, b) => b.totalUsd - a.totalUsd);
    };

    const ym = (d: Date | string) => {
      const date = d instanceof Date ? d : new Date(d);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    };

    return {
      totalUsd: round2(rows.reduce((s, r) => s + Number(r.discountUsd || 0), 0)),
      count: rows.length,
      byReason: bucket((r) => String(r.reason ?? "other"))
        .map((b) => ({ reason: b.key, totalUsd: b.totalUsd, count: b.count })),
      byMonth: bucket((r) => ym(r.createdAt))
        .map((b) => ({ ym: b.key, totalUsd: b.totalUsd, count: b.count }))
        .sort((a, b) => a.ym.localeCompare(b.ym)),
      byCustomer: bucket((r) => ({ id: Number(r.customerId), code: r.customerCode ?? null }))
        .map((b) => ({
          customerId: b.key.id, customerCode: b.key.code,
          totalUsd: b.totalUsd, count: b.count,
        })),
      byBatch: bucket((r) => ({ id: r.batchId ?? null, code: r.batchCode ?? null }))
        .map((b) => ({
          batchId: b.key.id, batchCode: b.key.code,
          totalUsd: b.totalUsd, count: b.count,
        })),
    };
  } catch (err) {
    appLogger.error("getDiscountReport failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return empty;
  }
}
