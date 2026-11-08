import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "./connection";
import { deliveryBoxes } from "../../drizzle/schema";
import { createBoxSettlement, getBoxSettlementView, type BoxSettlementView } from "./boxSettlement.db";
import { boxReceiptWritten } from "./boxPaidStillOwed.db";
import { finishPaidBox } from "../lib/boxLifecycle";
import {
  accountCover, allocateBoxDiscount, settlementTotals, unbackedOnReceiptUsd, unbilledOnReceiptUsd,
  type ParcelIntent,
} from "@shared/boxSettlement";
import { pledgeFloors } from "@shared/pledgedDiscount";
import { withFix } from "@shared/fixAdvice";

/**
 * A payment entered on the finance profile as an advance, whose owner says
 * «yes, give the box its remainder first» (owner, 2026-11-08).
 *
 * The box's share is taken THROUGH THE BOX - the same createBoxSettlement the
 * box's quick till uses, with the lines and promised discounts it would send,
 * the account's own advance counted the way the till counts it (accountCover)
 * - so the box decides paid, its receipt is written, and a box paid in full
 * finishes (finishPaidBox). Money is never put on a box any other way. What is
 * left of the amount is returned for the caller to record as the advance, by
 * the payments door it always used (ledger.recordPayment, with its guards).
 *
 * Boxes are paid oldest first. An amount smaller than a box's remainder goes
 * to that box whole, and the box stays paid in part.
 */

export type BoxPayMethod = "CASH" | "BANK_TRANSFER" | "FIB" | "FASTPAY" | "ZAINCASH" | "ASIAHAWALA" | "CARD" | "OTHER";

/** What the quick till would send for this box, and what it would ask in cash. */
export function quickSettlePlan(view: BoxSettlementView) {
  const parcels = view.parcels.filter((p) => p.outstandingUsd > 0 || p.notChargedYet);
  const floors = pledgeFloors(view.pledges);
  const boxCutByParcel = allocateBoxDiscount(floors.boxUsd, parcels, []);
  const intents: ParcelIntent[] = parcels.map((p) => ({
    lineId: p.lineId,
    discountUsd: (floors.byLine.get(p.lineId) ?? 0) + (boxCutByParcel.get(p.lineId) ?? 0),
  }));
  const totals = settlementTotals(parcels, intents);
  const cover = accountCover({
    othersUnwrittenUsd: view.earlierUnwrittenUsd ?? 0,
    dueUsd: totals.dueUsd + Number(view.extrasDueUsd ?? 0),
    balanceUsd: view.accountBalanceUsd ?? 0,
    openUsd: view.openChargesUsd ?? undefined,
    toChargeUsd: unbilledOnReceiptUsd(parcels, intents),
    correctionUsd: totals.correctionUsd,
    discountUsd: totals.discountUsd,
    unbackedUsd: unbackedOnReceiptUsd(parcels, totals.lines),
  });
  const boxPledge = view.pledges.filter((p) => p.lineId === null).sort((a, b) => b.usd - a.usd)[0] ?? null;
  return {
    cashDueUsd: Math.round(cover.cashDueUsd * 100) / 100,
    lines: parcels.map((p) => {
      const pledged = view.pledges.filter((q) => q.lineId === p.lineId).sort((a, b) => b.usd - a.usd)[0];
      const cut = floors.byLine.get(p.lineId) ?? 0;
      return {
        lineId: p.lineId,
        discountUsd: cut > 0 ? cut : undefined,
        discountReason: cut > 0 ? (pledged?.reason ?? "other") : undefined,
        discountNote: cut > 0 ? (pledged?.note ?? undefined) : undefined,
      };
    }),
    boxDiscount: floors.boxUsd > 0 ? { mode: "amount" as const, value: floors.boxUsd } : undefined,
    boxDiscountReason: floors.boxUsd > 0 ? (boxPledge?.reason ?? "other") : undefined,
    boxDiscountNote: floors.boxUsd > 0 ? (boxPledge?.note ?? undefined) : undefined,
  };
}

export interface BoxShare { boxId: number; boxCode: string; paidUsd: number; settlementNumber: string; leftOnBoxUsd: number; finished: boolean }

export async function payBoxesFirst(
  input: { customerId: number; amountUsd: number; paymentMethod: BoxPayMethod; boxIds: number[]; notes?: string },
  actor: { id: number; role?: string | null },
): Promise<{ boxes: BoxShare[]; leftUsd: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const amount = Math.round((Number(input.amountUsd) || 0) * 100) / 100;
  if (!(amount > 0) || input.boxIds.length === 0) return { boxes: [], leftUsd: Math.max(0, amount) };

  // Only this customer's own living boxes, oldest first.
  const rows = await db
    .select({ id: deliveryBoxes.id, boxCode: deliveryBoxes.boxCode })
    .from(deliveryBoxes)
    .where(and(
      inArray(deliveryBoxes.id, input.boxIds),
      eq(deliveryBoxes.customerId, input.customerId),
      ne(deliveryBoxes.status, "cancelled"),
    ))
    .orderBy(asc(deliveryBoxes.createdAt), asc(deliveryBoxes.id));
  if (rows.length !== new Set(input.boxIds).size) {
    throw new Error(withFix(
      "یەکێک لەو بۆکسانە هی ئەم کڕیارە نییە یان هەڵوەشاوەتەوە — هیچ پارەیەک نەنووسرا.",
      ["پەنجەرەکە دابخە و دووبارە بیکەرەوە تا لیستی بۆکسەکان نوێ ببێتەوە"],
    ));
  }

  let left = amount;
  const shares: BoxShare[] = [];
  for (const row of rows) {
    if (left <= 0.005) break;
    const view = await getBoxSettlementView(row.id);
    const plan = quickSettlePlan(view);
    if (plan.cashDueUsd <= 0.005 || plan.lines.length === 0) continue;
    const pay = Math.round(Math.min(left, plan.cashDueUsd) * 100) / 100;
    const short = plan.cashDueUsd - pay > 0.005;
    const split = `لە پارەدانێکی $${amount.toFixed(2)} لە پرۆفایلی دارایی: $${pay.toFixed(2)} بۆ بۆکسی ${row.boxCode}`;
    const res = await createBoxSettlement({
      boxId: row.id,
      lines: plan.lines,
      boxDiscount: plan.boxDiscount,
      boxDiscountReason: plan.boxDiscountReason as never,
      boxDiscountNote: plan.boxDiscountNote,
      amountUsd: pay,
      paymentMethod: input.paymentMethod,
      treatShortAs: "debt",
      differenceReason: short ? "بەشێکی دراوە — ماوەکەی لەسەر بۆکسەکە دەمێنێت" : undefined,
      notes: [split, input.notes].filter(Boolean).join(" — "),
      credit: { role: actor.role ?? null, approved: false },
    }, actor.id);
    boxReceiptWritten();
    const finish = await finishPaidBox(row.id, actor.id);
    shares.push({
      boxId: row.id,
      boxCode: row.boxCode,
      paidUsd: res.paidUsd,
      settlementNumber: res.settlementNumber,
      leftOnBoxUsd: Math.max(0, Math.round((plan.cashDueUsd - res.paidUsd) * 100) / 100),
      finished: finish.finished,
    });
    left = Math.round((left - res.paidUsd) * 100) / 100;
  }
  return { boxes: shares, leftUsd: Math.max(0, left) };
}
