import { and, desc, eq, inArray, like, ne } from "drizzle-orm";
import { getDb } from "./connection";
import {
  packages, customerAccounts, ledgerTransactions, invoices, revenueRecords, deliveryBoxes, deliveryBoxItems,
  fullPackageOrders, fullPackageOrderTrackings, packageOrderLinks,
  type InsertPackage, type LedgerTransaction, type Package,
} from "../../drizzle/schema";
import {
  adjustCharge, reverseCharge, effectiveChargeUsd, updateDailyFinancialSummary, type UndoOptions,
} from "./finance.db";
import { parcelOwnCharges, parcelReceipt, PARCEL_CHARGE_TYPES } from "./parcelDeletion.db";
import {
  orderClaimsTracking, parcelInvoiceLine, shippingChargeDueNow, type ShippingChargeDue,
} from "./batchCharging.db";
import { withFix } from "@shared/fixAdvice";
import { ownerChanged } from "@shared/parcelCorrection";
import { appLogger } from "../utils/logger";

/**
 * Put a registered parcel right, and its money with it.
 *
 * The owner, 2026-10-05: «کاتێ لە تۆماری خێرا ئۆردەرێ تۆمار دەکەی، ئەگەر هەڵەت
 * لە کێش یا قیاس یا لە شتێ کرد، ڕیتێرنی دوایین تۆمار هەبێ … بەس دەقیق بێت».
 * And, asked how: the same parcel is corrected — the same code — and only the
 * difference in the money is written.
 *
 * A parcel registered into a priced batch owes its shipping from that moment
 * (2026-09-09), so a weight typed wrong is a debt written wrong. Editing the
 * parcel does not move a debt — deliberately (2026-09-21) — which left the
 * counter one cure: have an admin delete the parcel and register it again,
 * under a new code.
 *
 * This is the deliberate door. In one transaction:
 *
 *  - the facts on the row are replaced by the corrected ones;
 *  - the same owner, and still something to charge: the parcel's charge is
 *    moved to the right figure by the DIFFERENCE alone (adjustCharge), and
 *    the invoice and the revenue record written with it follow;
 *  - a different owner, or nothing left to charge: the charge comes off whole
 *    (reverseCharge) and the parcel is marked uncharged, so its batch charges
 *    it again — to whoever owns it now — by the rule it always has.
 *
 * If any step fails, none of it happened. Nothing here decides a price: what
 * the charge should stand at is asked of the line that posts charges
 * (shippingChargeDueNow in batchCharging.db).
 *
 * Refused, with the cure: a parcel paid on a box receipt, a parcel already in
 * a delivery box, and a parcel whose money is not where it should be.
 */

/** The row as it should read after the correction. */
export interface ParcelCorrectionFacts {
  customerId: number | null;
  isUnclaimed: boolean;
  weightKg: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  volumeCbm: string | null;
  description: string | null;
  categoryId: number | null;
  /** Undefined leaves the photographs as they are. */
  photos?: string[];
  /** The stored price for the corrected facts, resolved by the caller. */
  calculatedCostUsd: string | null;
  appliedPricingRuleId: number | null;
}

export type ParcelCorrectionMoney =
  /** Nothing on any account moved. */
  | "none"
  /** The same charge, moved by the difference. */
  | "adjusted"
  /** The charge came off whole; nothing is due for the parcel as it now reads. */
  | "reversed"
  /** The charge came off the owner it was wrongly given to. */
  | "moved";

export interface ParcelCorrectionResult {
  money: ParcelCorrectionMoney;
  /** What stood on the account for this parcel before the correction. */
  wasUsd: number;
  /** What stands on that same account for it afterwards. */
  nowUsd: number;
  /** The parcel is uncharged now and something is due: its batch must be asked to charge it. */
  chargeAfter: boolean;
}

/**
 * The last parcel this person registered — the only one Quick Register puts
 * right in place. Every other parcel is corrected from the parcel list.
 */
export async function getLastParcelRegisteredBy(userId: number): Promise<Package | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(packages)
    .where(eq(packages.registeredById, userId))
    .orderBy(desc(packages.id))
    .limit(1);
  return row;
}

export interface OrderBehindParcel {
  id: number;
  orderCode: string;
  orderType: string;
  customerId: number | null;
  isShippingCharged: boolean;
}

/**
 * The orders a parcel travels for — by the link, by the join table and by the
 * tracking number, the same routes every other reader follows. A parcel with
 * any of these carries no charge of its own: its money is on the order.
 */
export async function ordersBehindParcel(
  pkg: Pick<Package, "id" | "fullPackageOrderId" | "trackingNumber">,
): Promise<OrderBehindParcel[]> {
  const db = await getDb();
  if (!db) return [];
  const ids = new Set<number>();
  if (pkg.fullPackageOrderId) ids.add(pkg.fullPackageOrderId);

  const links = await db
    .select({ id: packageOrderLinks.fullPackageOrderId })
    .from(packageOrderLinks)
    .where(eq(packageOrderLinks.packageId, pkg.id));
  for (const link of links) ids.add(link.id);

  if (pkg.trackingNumber) {
    const direct = await db
      .select({ id: fullPackageOrders.id })
      .from(fullPackageOrders)
      .where(eq(fullPackageOrders.trackingNumber, pkg.trackingNumber));
    for (const order of direct) ids.add(order.id);
    const listed = await db
      .select({ id: fullPackageOrderTrackings.fullPackageOrderId })
      .from(fullPackageOrderTrackings)
      .where(eq(fullPackageOrderTrackings.trackingNumber, pkg.trackingNumber));
    for (const order of listed) ids.add(order.id);
  }
  if (ids.size === 0) return [];

  const rows = await db
    .select({
      id: fullPackageOrders.id,
      orderCode: fullPackageOrders.orderCode,
      orderType: fullPackageOrders.orderType,
      customerId: fullPackageOrders.customerId,
      isShippingCharged: fullPackageOrders.isShippingCharged,
    })
    .from(fullPackageOrders)
    .where(inArray(fullPackageOrders.id, Array.from(ids)));
  return rows.map((row) => ({
    id: Number(row.id),
    orderCode: String(row.orderCode),
    orderType: String(row.orderType),
    customerId: row.customerId ?? null,
    isShippingCharged: Boolean(row.isShippingCharged),
  }));
}

/** The receipt, the box, or nothing: why a parcel cannot be corrected here. */
export async function parcelCorrectionRefusal(packageId: number, name: string): Promise<string | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const receipt = await parcelReceipt(packageId);
  if (receipt) {
    return withFix(
      `پاکەتی ${name} لێرە چاک ناکرێتەوە: پارەکەی لە وەسڵی ${receipt.settlementNumber} ـی بۆکسی ${receipt.boxCode ?? ""} وەرگیراوە. گۆڕینی کێش یان خاوەنەکەی ئێستا، پارەی وەرگیراو و قەرزی سەر حیساب لێک جیا دەکاتەوە.`,
      [
        `بۆکسی ${receipt.boxCode ?? ""} بکەرەوە و وەسڵەکە هەڵبوەشێنەوە`,
        "ئینجا پاکەتەکە چاک بکەرەوە",
        "دواتر دووبارە واصڵی بکەرەوە بە بڕە ڕاستەکە",
      ],
    );
  }

  const [boxed] = await db
    .select({ boxCode: deliveryBoxes.boxCode })
    .from(deliveryBoxItems)
    .leftJoin(deliveryBoxes, eq(deliveryBoxes.id, deliveryBoxItems.boxId))
    .where(eq(deliveryBoxItems.packageId, packageId))
    .limit(1);
  if (boxed) {
    return withFix(
      `پاکەتی ${name} لێرە چاک ناکرێتەوە: خراوەتە ناو بۆکسی ${boxed.boxCode ?? ""}، و بۆکس کێش و نرخی پاکەتەکەی لای خۆی نووسیوە. گۆڕینی لێرە، بۆکسەکە بە ژمارە کۆنەکەوە بەجێ دەهێڵێت.`,
      [
        `بۆکسی ${boxed.boxCode ?? ""} بکەرەوە و پاکەتەکەی لێ دەربهێنە`,
        "ئینجا پاکەتەکە چاک بکەرەوە و بیخەرەوە ناو بۆکسەکە",
        "یان لە شاشەی پارەدانی بۆکس، نرخەکەی بە «ڕاستکردنەوە» چاک بکە",
      ],
    );
  }

  return null;
}

/**
 * The invoice written with the charge reads the corrected figure too.
 *
 * adjustCharge writes the one new amount over the invoice total — right for
 * an invoice of one parcel, wrong for one that carries several (a batch
 * priced after its parcels were registered bills each customer's parcels on
 * one invoice). So the total is added up again from every charge the invoice
 * carries, each at what it stands at now, and this parcel's own line is
 * rewritten in the words the charge wrote it with.
 */
async function invoiceFollows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  charge: LedgerTransaction,
  name: string,
  due: ShippingChargeDue,
): Promise<void> {
  if (!charge.invoiceId) return;
  const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, charge.invoiceId)).limit(1);
  if (!invoice) return;

  const debits: LedgerTransaction[] = await tx
    .select()
    .from(ledgerTransactions)
    .where(and(
      eq(ledgerTransactions.invoiceId, charge.invoiceId),
      inArray(ledgerTransactions.transactionType, [...PARCEL_CHARGE_TYPES]),
    ));
  let cents = 0;
  for (const debit of debits) {
    cents += Math.round(Math.max(0, await effectiveChargeUsd(tx, debit)) * 100);
  }
  const total = (cents / 100).toFixed(2);

  const lines: Array<{ description: string; quantity: number; unitPrice: number; total: number }> =
    Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const heading = `پاکەت ${name}`;
  const mine = lines.filter((line) => String(line?.description ?? "").split("\n")[0].trim() === heading);
  const lineItems = mine.length === 1
    ? lines.map((line) => (line === mine[0]
        ? parcelInvoiceLine(name, due.unit === "cbm", due.rate, due.quantity, due.amount)
        : line))
    : lines;

  // The invoice's own "grand total" note, when it carries one.
  const GRAND_TOTAL = "کۆی گشتی: $";
  const notes = typeof invoice.notes === "string"
    ? invoice.notes
        .split("\n")
        .map((line: string) => (line.startsWith(GRAND_TOTAL) ? `${GRAND_TOTAL}${total}` : line))
        .join("\n")
    : invoice.notes;

  await tx.update(invoices).set({ subtotalUsd: total, totalUsd: total, lineItems, notes })
    .where(eq(invoices.id, charge.invoiceId));
}

/**
 * The revenue recorded for the parcel is the charge, so it moves with it.
 *
 * Returns what the day's summary has to be moved by, which the caller does
 * once the correction has committed — the summary is a running total kept
 * outside any transaction, by the function that keeps it everywhere else.
 */
async function revenueFollows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  packageId: number,
  amountUsd: number,
): Promise<{ recordDate: Date; revenueType: string; deltaUsd: number } | null> {
  const records = await tx
    .select()
    .from(revenueRecords)
    .where(and(
      eq(revenueRecords.referenceType, "package"),
      eq(revenueRecords.referenceId, packageId),
      ne(revenueRecords.status, "cancelled"),
    ));
  if (records.length !== 1) {
    // None: the charge was posted by a door that records no revenue. More
    // than one: which of them is this charge cannot be known from here.
    if (records.length > 1) {
      appLogger.warn("[ParcelCorrection] more than one revenue record for a parcel — left as they are", {
        packageId, records: records.length,
      });
    }
    return null;
  }
  const record = records[0];
  const was = parseFloat(record.amountUsd || "0") || 0;
  const cost = parseFloat(record.costUsd || "0") || 0;
  const deltaUsd = Math.round((amountUsd - was) * 100) / 100;
  if (Math.abs(deltaUsd) < 0.005) return null;
  await tx.update(revenueRecords).set({
    amountUsd: amountUsd.toFixed(2),
    profitUsd: (amountUsd - cost).toFixed(2),
  }).where(eq(revenueRecords.id, record.id));
  return { recordDate: record.recordDate, revenueType: record.revenueType, deltaUsd };
}

/**
 * A correction that touches nothing behind the price: the description, the
 * category, the photographs. The row is written and the account is not even
 * read — fixing a photograph must not reprice a parcel behind anybody's back.
 */
export async function applyParcelDetails(
  packageId: number,
  facts: Pick<ParcelCorrectionFacts, "description" | "categoryId" | "photos">,
): Promise<ParcelCorrectionResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const set: Partial<InsertPackage> = { description: facts.description, categoryId: facts.categoryId };
  if (facts.photos !== undefined) set.photos = facts.photos;
  await db.update(packages).set(set).where(eq(packages.id, packageId));
  return { money: "none", wasUsd: 0, nowUsd: 0, chargeAfter: false };
}

export async function applyParcelCorrection(
  packageId: number,
  userId: number,
  facts: ParcelCorrectionFacts,
  /** Why, in the words the customer's statement and the bell will show. */
  reason: string,
  opts?: UndoOptions,
): Promise<ParcelCorrectionResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1);
  if (!pkg) {
    throw new Error(withFix(
      "ئەم پاکەتە نەدۆزرایەوە — لەوانەیە سڕدرابێتەوە.",
      ["لاپەڕەکە نوێ بکەرەوە", "لە «هەموو پاکەتەکان» بە تراکەکەی بگەڕێ"],
    ));
  }
  const name = pkg.trackingNumber || pkg.packageCode || String(packageId);

  const refusal = await parcelCorrectionRefusal(packageId, name);
  if (refusal) throw new Error(refusal);

  // An order's parcel carries no charge of its own: its money is on the order.
  const orderLinked = pkg.fullPackageOrderId !== null || await orderClaimsTracking(pkg.trackingNumber);

  // What the parcel, as it now reads, should be charged — asked of the line
  // that posts charges, never worked out here.
  const due = await shippingChargeDueNow({
    ...pkg,
    customerId: facts.customerId,
    isUnclaimed: facts.isUnclaimed,
    weightKg: facts.weightKg,
    lengthCm: facts.lengthCm,
    widthCm: facts.widthCm,
    heightCm: facts.heightCm,
    volumeCbm: facts.volumeCbm,
  });

  const result = await db.transaction(async (tx) => {
    // Held for the length of the correction: two people correcting the same
    // parcel must not both read the charge before either has moved it.
    const [row] = await tx.select().from(packages).where(eq(packages.id, packageId)).for("update").limit(1);
    if (!row) throw new Error("ئەم پاکەتە لە کاتی چاککردنەوەدا سڕایەوە — لاپەڕەکە نوێ بکەرەوە.");

    const newOwner = ownerChanged(row, facts);

    // The parcel's own charges still standing on its owner's account.
    const standing: Array<{ charge: LedgerTransaction; usd: number }> = [];
    if (row.customerId && !orderLinked) {
      const [account] = await tx
        .select({ id: customerAccounts.id })
        .from(customerAccounts)
        .where(eq(customerAccounts.customerId, row.customerId))
        .limit(1);
      if (account) {
        for (const charge of await parcelOwnCharges(tx, account, packageId)) {
          const [cancelled] = await tx
            .select({ id: ledgerTransactions.id })
            .from(ledgerTransactions)
            .where(and(
              eq(ledgerTransactions.accountId, account.id),
              eq(ledgerTransactions.transactionType, "ADJUSTMENT_CREDIT"),
              like(ledgerTransactions.description, `%[REV:${charge.transactionNumber}]%`),
            ))
            .limit(1);
          if (cancelled) continue;
          standing.push({ charge, usd: await effectiveChargeUsd(tx, charge) });
        }
      }
    }

    if (standing.length > 1) {
      throw new Error(withFix(
        `پاکەتی ${name} لێرە چاک ناکرێتەوە: ${standing.length} بارکردنی لەسەر حیسابی کڕیار هەیە، نەک یەک. چاککردنەوەی یەکێکیان ئەوی تر بە هەڵە بەجێ دەهێڵێت.`,
        [
          "ئادمینی سەرەکی ئاگادار بکە — ئەمە دوو جار حیسابکردنە و دەبێت یەکێکیان هەڵبوەشێتەوە",
          "دوای ئەوە پاکەتەکە چاک بکەرەوە",
        ],
      ));
    }
    if (standing.length === 0 && row.isCharged && !orderLinked) {
      throw new Error(withFix(
        `پاکەتی ${name} لێرە چاک ناکرێتەوە: وەک «حیسابکراو» نیشانە کراوە، بەڵام بارکردنەکەی لەسەر حیسابی خاوەنەکەی نییە. گۆڕینی ئێستا پارەیەک دەجووڵێنێت کە نازانرێت لە کوێیە.`,
        [
          "لە «هەموو پاکەتەکان» پاکەتەکە بکەرەوە و سەیری خاوەنەکەی بکە — لەوانەیە دوای حیسابکردن گۆڕدرابێت",
          "ئادمینی سەرەکی ئاگادار بکە بۆ ئەوەی بارکردنەکە بدۆزێتەوە و ڕاستی بکاتەوە",
        ],
      ));
    }

    let money: ParcelCorrectionMoney = "none";
    let wasUsd = 0;
    let nowUsd = 0;
    let released = false;
    let revenue: { recordDate: Date; revenueType: string; deltaUsd: number } | null = null;

    if (standing.length === 1) {
      const { charge, usd } = standing[0];
      wasUsd = usd;
      if (!newOwner && due.due) {
        // The same owner, a different figure: the difference, and only that.
        const { adjustmentTransaction } = await adjustCharge(charge.id, due.amount, reason, userId, tx, opts);
        if (adjustmentTransaction) {
          money = "adjusted";
          nowUsd = due.amount;
          await invoiceFollows(tx, charge, name, due);
          revenue = await revenueFollows(tx, packageId, due.amount);
        } else {
          nowUsd = usd;
        }
      } else {
        // Not this owner's any more, or nothing left to charge: it comes off
        // whole, and the batch charges the parcel again as it now reads.
        await reverseCharge(charge.id, reason, userId, tx, opts);
        nowUsd = 0;
        released = true;
        money = newOwner ? "moved" : "reversed";
      }
    }

    const set: Partial<InsertPackage> = {
      customerId: facts.customerId,
      isUnclaimed: facts.isUnclaimed,
      weightKg: facts.weightKg,
      lengthCm: facts.lengthCm,
      widthCm: facts.widthCm,
      heightCm: facts.heightCm,
      volumeCbm: facts.volumeCbm,
      description: facts.description,
      categoryId: facts.categoryId,
      calculatedCostUsd: facts.calculatedCostUsd,
      appliedPricingRuleId: facts.appliedPricingRuleId,
    };
    if (facts.photos !== undefined) set.photos = facts.photos;
    if (released) set.isCharged = false;
    await tx.update(packages).set(set).where(eq(packages.id, packageId));

    const chargedNow = released ? false : Boolean(row.isCharged);
    return { money, wasUsd, nowUsd, chargeAfter: !chargedNow && due.due, revenue };
  });

  // The day's running revenue total, moved by the same difference. Kept
  // outside the transaction by the function that keeps it everywhere else;
  // a failure here must not undo a correction that is already saved.
  if (result.revenue) {
    try {
      await updateDailyFinancialSummary(result.revenue.recordDate, {
        addRevenue: result.revenue.deltaUsd,
        revenueType: result.revenue.revenueType,
      });
    } catch (err) {
      appLogger.warn("[ParcelCorrection] daily summary not moved", {
        packageId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  appLogger.info("[ParcelCorrection] parcel corrected", {
    packageId, money: result.money, wasUsd: result.wasUsd, nowUsd: result.nowUsd, chargeAfter: result.chargeAfter,
  });
  return { money: result.money, wasUsd: result.wasUsd, nowUsd: result.nowUsd, chargeAfter: result.chargeAfter };
}
