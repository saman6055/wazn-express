/**
 * The box decides (owner, 2026-10-19).
 *
 * "Money is counted when it is put in a box and the box's money is taken.
 * Other parts only add debt; the box decides what was paid and what was not."
 *
 * The till already lives by it: paying a box writes whatever its goods still
 * lack on the account - an order's goods (chargeOrdersInBox), a carton's
 * freight (postOrderFreight), a parcel never charged - and marks each one
 * (`isCharged`, `isShippingCharged`), the flags every batch-delivery path
 * reads before it charges. So marking a batch delivered after its boxes were
 * paid writes nothing twice, and nobody has to close a batch for an account
 * to be right.
 *
 * What did not live by it: boxes receipted before the till wrote anything.
 * AZ295, BOX-20260924-010, receipted 2026-09-25: $211.78 of goods and freight
 * counted on the receipt, $44 off, $200 taken - and none of it ever written
 * on the account, so the $200 looked like a payment against nothing. The
 * only door left for those charges was the batch, and the batch is not the
 * box.
 *
 * chargeReceiptedBox is that door, through the box: it writes what the
 * receipt counted and the account never got, with the till's own steps and
 * flags. The receipt's figure is the price - the box decided it and the
 * customer saw it printed. Where the receipt counted only an order's goods,
 * the carton's freight is written at the system's price and stays owed: a
 * debt is added, nothing is forgiven unasked.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "./connection";
import { boxSettlements, boxSettlementLines } from "../../drizzle/schema/finance.schema";
import { deliveryBoxes, packages } from "../../drizzle/schema";
import { chargeOrdersInBox } from "./orderCharging.db";
import { getBoxSettlementView, postOrderFreight } from "./boxSettlement.db";
import { recordPackageChargeWithoutInvoice } from "./finance.db";
import { markLinkedOrdersCharged } from "./packages.db";
import { withFix } from "@shared/fixAdvice";
import { appLogger } from "../utils/logger";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ReceiptedBoxCharge {
  boxCode: string;
  customerCode: string | null;
  /** Each line written, in the box's order. */
  /** The orders' goods written first, through chargeOrdersInBox. */
  goods: { orders: number; amountUsd: number };
  /** Each freight or parcel line written after, in the box's order. */
  posted: Array<{ tracking: string | null; what: "freight" | "parcel"; amountUsd: number }>;
  totalUsd: number;
  /** Parcels the receipt counted that could not be written, and why. */
  left: Array<{ tracking: string | null; reason: string }>;
}

/**
 * What a receipted box still lacks on the account, written through the box.
 * Runs again harmlessly: everything it writes is marked, so a second run
 * finds nothing left.
 */
export async function chargeReceiptedBox(boxId: number, userId: number): Promise<ReceiptedBoxCharge> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [box] = await db
    .select({ id: deliveryBoxes.id, boxCode: deliveryBoxes.boxCode })
    .from(deliveryBoxes)
    .where(eq(deliveryBoxes.id, boxId))
    .limit(1);
  if (!box) throw new Error(withFix("ئەم بۆکسە نەدۆزرایەوە.", ["لیستی بۆکسەکان نوێ بکەرەوە", "ئەگەر سڕاوەتەوە، لە سەبەتەی سڕاوەکان بیگەڕێنەوە"]));

  // Only what a confirmed receipt counted - the box's own decision.
  const lines = await db
    .select({ boxItemId: boxSettlementLines.boxItemId })
    .from(boxSettlementLines)
    .innerJoin(boxSettlements, eq(boxSettlements.id, boxSettlementLines.settlementId))
    .where(and(
      eq(boxSettlements.boxId, boxId),
      eq(boxSettlements.status, "confirmed"),
      eq(boxSettlementLines.isHeld, false),
    ));
  const receipted = new Set(lines.map((l) => Number(l.boxItemId)).filter(Boolean));
  if (receipted.size === 0) {
    throw new Error(withFix(
      `بۆکسی ${box.boxCode} هیچ وەسڵێکی نییە — ئەم ڕاستکردنەوەیە تەنها بۆ بۆکسێکە کە پارەکەی وەرگیراوە.`,
      ["بۆکسێک کە هێشتا وەسڵ نەکراوە، لە کاتی وەسڵکردندا خۆی هەموو شتێک دەنووسێت — پێویستی بەمە نییە"],
    ));
  }

  // 1. The goods: the same charge an order entered today takes, marked.
  const goods = await chargeOrdersInBox(boxId, userId);

  // 2. Read the box again, as the till does, and write what is still missing.
  const view = await getBoxSettlementView(boxId);
  const customer = view.customer;
  if (!customer) throw new Error(withFix("کڕیاری ئەم بۆکسە نەدۆزرایەوە.", ["بۆکسەکە بکەرەوە و کڕیارەکەی بپشکنە"]));

  const result: ReceiptedBoxCharge = {
    boxCode: box.boxCode,
    customerCode: customer.customerCode,
    goods: { orders: goods.charged, amountUsd: goods.amountUsd },
    posted: [],
    totalUsd: 0,
    left: [],
  };

  await db.transaction(async (tx) => {
    // The till's lock: a payment at this box waits for this, and this for it.
    await tx.select({ id: deliveryBoxes.id }).from(deliveryBoxes).where(eq(deliveryBoxes.id, boxId)).for("update").limit(1);

    for (const p of view.parcels) {
      if (!receipted.has(p.lineId)) continue;
      // What the receipt counted for this parcel: paid plus forgiven.
      const counted = round2(p.settledUsd + p.discountedUsd);

      if (p.fromOrder) {
        if (p.notChargedYet) {
          // The order's goods could not be written (no price, a quote, no customer).
          result.left.push({ tracking: p.trackingNumber, reason: "goods_not_charged" });
          continue;
        }
        if (!(p.pendingFreightUsd > 0) || !p.freightOrder) continue;
        const goodsUsd = round2(p.chargedUsd - p.pendingFreightUsd);
        // The receipt counted the freight too: its figure. Counted only the
        // goods: the system's freight, which stays owed.
        const freightUsd = counted > goodsUsd + 0.005 ? round2(counted - goodsUsd) : p.pendingFreightUsd;
        await postOrderFreight(tx, customer, box.boxCode, p.freightOrder, freightUsd, userId, "وەسڵی کۆن");
        result.posted.push({ tracking: p.trackingNumber, what: "freight", amountUsd: freightUsd });
        continue;
      }

      if (!p.notChargedYet || p.packageId === null) continue;
      const amountUsd = counted > 0.005 ? counted : p.chargedUsd;
      if (!(amountUsd > 0)) continue;
      await recordPackageChargeWithoutInvoice(
        customer.id,
        customer.customerCode ?? String(customer.id),
        p.packageId,
        amountUsd,
        `${box.boxCode} — ${p.trackingNumber ?? p.packageCode ?? ""} — وەسڵی کۆن`.trim(),
        userId,
        undefined,
        tx,
      );
      await tx.update(packages).set({ isCharged: true }).where(eq(packages.id, p.packageId));
      await markLinkedOrdersCharged([p.packageId], tx);
      result.posted.push({ tracking: p.trackingNumber, what: "parcel", amountUsd });
    }
  });

  result.totalUsd = round2(goods.amountUsd + result.posted.reduce((s, r) => s + r.amountUsd, 0));
  appLogger.info("[BoxDecides] old receipt written through its box", { boxId, ...result });
  return result;
}
