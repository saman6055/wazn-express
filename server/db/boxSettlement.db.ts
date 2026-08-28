import { eq, and, desc, inArray, sql, gte, lte } from "drizzle-orm";
import { getDb } from "./connection";
import {
  boxSettlements,
  boxSettlementLines,
  ledgerTransactions,
  customerAccounts,
} from "../../drizzle/schema/finance.schema";
import { deliveryBoxes, deliveryBoxItems, packages } from "../../drizzle/schema";
import { customers, users } from "../../drizzle/schema/users.schema";
import { batches } from "../../drizzle/schema/batches.schema";
import type { BoxSettlement } from "../../drizzle/schema/finance.schema";
import { appLogger } from "../utils/logger";
import { recordPaymentReceived, adjustCharge, recordPackageChargeWithoutInvoice } from "./finance.db";
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
  packageId: number;
  trackingNumber: string | null;
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

/**
 * Everything the settlement screen needs, in one call.
 *
 * Deliberately one call: the screen opens at a counter with a customer
 * standing at it, and four round trips to fill in one table is four chances
 * to show half a number.
 */
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

  const packageIds = Array.from(new Set(
    items.map((r) => r.item.packageId).filter((id): id is number => !!id),
  ));

  // Every ledger row that touches these parcels, in one query rather than one
  // per parcel — a box can hold forty.
  const ledgerRows = packageIds.length
    ? await db
        .select({
          referenceId: ledgerTransactions.referenceId,
          transactionType: ledgerTransactions.transactionType,
          amountUsd: ledgerTransactions.amountUsd,
        })
        .from(ledgerTransactions)
        .where(and(
          eq(ledgerTransactions.referenceType, "package"),
          inArray(ledgerTransactions.referenceId, packageIds),
        ))
    : [];

  const charged = new Map<number, number>();
  const discounted = new Map<number, number>();
  const seenAnyCharge = new Set<number>();
  for (const row of ledgerRows) {
    const id = Number(row.referenceId);
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
  const settledRows = packageIds.length
    ? await db
        .select({
          packageId: boxSettlementLines.packageId,
          paid: sql<string>`SUM(${boxSettlementLines.paidUsd})`,
        })
        .from(boxSettlementLines)
        .innerJoin(boxSettlements, eq(boxSettlements.id, boxSettlementLines.settlementId))
        .where(and(
          inArray(boxSettlementLines.packageId, packageIds),
          eq(boxSettlements.status, "confirmed"),
        ))
        .groupBy(boxSettlementLines.packageId)
    : [];
  const settled = new Map(settledRows.map((r) => [Number(r.packageId), Number(r.paid || 0)]));

  const parcels: BoxParcelView[] = items
    .filter((r) => r.item.packageId)
    .map((r) => {
      const packageId = Number(r.item.packageId);
      const fromLedger = charged.get(packageId);
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
        fromLedger !== undefined ? fromLedger : Number(r.item.calculatedCostUsd || 0),
      );
      const discountedUsd = round2(discounted.get(packageId) ?? 0);
      const settledUsd = round2(settled.get(packageId) ?? 0);
      return {
        packageId,
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
        notChargedYet: !seenAnyCharge.has(packageId),
      };
    });

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
  const [rateRow] = await db
    .select({ rate: boxSettlements.exchangeRate })
    .from(boxSettlements)
    .where(sql`${boxSettlements.exchangeRate} IS NOT NULL AND ${boxSettlements.exchangeRate} > 0`)
    .orderBy(desc(boxSettlements.createdAt))
    .limit(1);

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
    parcels,
    settlements: history.map((h) => ({ ...h.s, staffName: h.staffName ?? null })),
    lastExchangeRate: rateRow?.rate ? Number(rateRow.rate) : null,
    accountBalanceUsd: Number(account?.balance ?? 0),
  };
}

export interface SettlementLineInput {
  packageId: number;
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

  const requested = new Set(input.lines.map((l) => l.packageId));
  const parcels = view.parcels.filter((p) => requested.has(p.packageId));
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
  const toCharge = parcels.filter(
    (p) => p.notChargedYet
      && p.chargedUsd > 0
      && !input.lines.find((l) => l.packageId === p.packageId)?.held,
  );

  // A discount on the whole box is spread over its parcels first, then added
  // to whatever was already forgiven on a line of its own. Both end up in the
  // same column, which is what keeps the report and the balance honest.
  const held = input.lines.filter((l) => l.held).map((l) => l.packageId);
  const boxCut = input.boxDiscount ? boxDiscountUsd(input.boxDiscount, parcels) : 0;
  if (boxCut > 0 && !input.boxDiscountReason) {
    throw new Error("هۆکاری داشکاندن پێویستە — بەبێ ئەو، ڕاپۆرتی داشکاندن بێ واتایە");
  }
  const boxCutByParcel = allocateBoxDiscount(boxCut, parcels, held);

  const intents: ParcelIntent[] = input.lines.map((l) => ({
    packageId: l.packageId,
    held: l.held,
    correctionUsd: l.correctionUsd,
    discountUsd: round2((l.discountUsd ?? 0) + (boxCutByParcel.get(l.packageId) ?? 0)),
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
        parcel.packageId,
        parcel.chargedUsd,
        `${box.boxCode} — ${parcel.trackingNumber ?? parcel.packageCode ?? ""}`.trim(),
        userId,
        undefined,
        tx,
      );
      // The flag every other charging path checks, so this parcel cannot be
      // charged a second time when its batch is eventually marked delivered.
      await tx.update(packages).set({ isCharged: true }).where(eq(packages.id, parcel.packageId));
    }

    // 1. Corrections change the price, so they go in before anything is paid.
    for (const line of input.lines) {
      const delta = Number(line.correctionUsd ?? 0);
      if (delta === 0) continue;
      const parcel = parcels.find((p) => p.packageId === line.packageId);
      if (!parcel) continue;
      const [chargeTxn] = await tx
        .select({ id: ledgerTransactions.id })
        .from(ledgerTransactions)
        .where(and(
          eq(ledgerTransactions.referenceType, "package"),
          eq(ledgerTransactions.referenceId, line.packageId),
          inArray(ledgerTransactions.transactionType, [...CHARGE_TYPES]),
        ))
        .orderBy(desc(ledgerTransactions.id))
        .limit(1);
      if (!chargeTxn) {
        throw new Error(`ناتوانرێت نرخی پارسێلی ${line.packageId} ڕاست بکرێتەوە — بارکردنی سەرەکی نەدۆزرایەوە`);
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
        lines: totals.lines.filter((l) => l.discountUsd > 0),
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
      const source = input.lines.find((l) => l.packageId === line.packageId);
      await tx.insert(boxSettlementLines).values({
        settlementId,
        packageId: line.packageId,
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

    return { settlementId, settlementNumber, paidUsd, differenceKind: difference.kind };
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
    lines: Array<{ packageId: number; discountUsd: number }>;
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
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    await tx.insert(ledgerTransactions).values({
      accountId: account.id,
      transactionNumber: `TXN-${day}-${Math.floor(Math.random() * 100000).toString().padStart(5, "0")}`,
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

    // Put back everything this settlement took off the balance — the payment
    // and any discount alike. Both left the customer owing less; undoing one
    // and not the other would leave the account quietly wrong.
    const putBack = round2(Number(settlement.paidUsd || 0) + Number(settlement.discountUsd || 0));
    if (putBack > 0) {
      const before = Number(account.currentBalanceUsd || 0);
      const after = round2(before + putBack);
      const balanceIqd = Number(account.currentBalanceIqd || 0);
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      await tx.insert(ledgerTransactions).values({
        accountId: account.id,
        transactionNumber: `TXN-${day}-${Math.floor(Math.random() * 100000).toString().padStart(5, "0")}`,
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
      await tx
        .update(customerAccounts)
        .set({ currentBalanceUsd: after.toFixed(2), lastTransactionAt: new Date() })
        .where(eq(customerAccounts.id, account.id));
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
