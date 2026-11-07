import { and, eq, notInArray } from "drizzle-orm";
import { getDb } from "./connection";
import { packages, type Package } from "../../drizzle/schema";
import { getBatchById } from "./batches.db";
import { shippingChargeDueNow } from "./batchCharging.db";
import { applyParcelCorrection, parcelMoneyHold } from "./parcelCorrection.db";
import { smallParcelRuleOn } from "./smallParcel.db";
import { appLogger } from "../utils/logger";
import { withFix } from "@shared/fixAdvice";

/**
 * Sea parcels put to the small-parcel rule as it now stands.
 *
 * Since 2026-11-07 (owner approved) each parcel is measured by itself, so a
 * new parcel no longer moves its owner's earlier ones - the customer-total
 * rebalance is gone. What is left to do here is what changes a parcel's own
 * answer:
 *
 *   - the batch's box (the master switch) is ticked or unticked: every parcel
 *     of the batch is re-priced (repriceSmallParcels);
 *   - the office ticks or unticks «بێ زیادە بۆ ئەم پاکەتە» on one parcel: that
 *     parcel alone is re-priced (setSmallParcelWaiver).
 *
 * Each change goes through the one correction there is (applyParcelCorrection):
 * on the parcel's own ledger row (one parcel, one line), its invoice line and
 * revenue following, the box's own line following while the box is open.
 * A parcel whose box is receipted is never touched - box receipted = settled.
 * A charge is only moved while the batch would charge it (due), so a parcel of
 * a batch not under charge-on-pricing is left as it stands.
 */

type Actor = { id: number; role?: string | null };

async function repriceOne(pkg: Package, actor: Actor, reason: string): Promise<"changed" | "same"> {
  const due = await shippingChargeDueNow(pkg);
  if (!due.due) return "same";
  const stands = Number(pkg.calculatedCostUsd ?? 0) || 0;
  if (Math.abs(due.amount - stands) < 0.005) return "same";
  const name = pkg.trackingNumber || pkg.packageCode;
  await applyParcelCorrection(
    pkg.id,
    actor.id,
    {
      customerId: pkg.customerId,
      isUnclaimed: Boolean(pkg.isUnclaimed),
      weightKg: pkg.weightKg,
      lengthCm: pkg.lengthCm,
      widthCm: pkg.widthCm,
      heightCm: pkg.heightCm,
      volumeCbm: pkg.volumeCbm,
      description: pkg.description,
      categoryId: pkg.categoryId,
      calculatedCostUsd: due.amount.toFixed(2),
      appliedPricingRuleId: pkg.appliedPricingRuleId,
    },
    `${reason} — نرخی پاکەتی ${name} لە $${stands.toFixed(2)} بوو بە $${due.amount.toFixed(2)}`,
    // The box follows while it is open; a receipt still refuses.
    { allowCredit: false, actorRole: actor.role ?? null, boxFollows: { weightKg: String(pkg.weightKg ?? "0") } },
  );
  return "changed";
}

/**
 * Every parcel of a sea batch (or of one customer in it) put to the rule as
 * it now reads. Parcels on a receipt are left and named; nothing stops the
 * work that called this.
 */
export async function repriceSmallParcels(
  batchId: number | null | undefined,
  customerId: number | null | undefined,
  actor: Actor,
  /** The parcel just written or corrected: it is already right. */
  exceptPackageId?: number | null,
): Promise<{ changed: number; left: number; leftNames: string[] }> {
  const result = { changed: 0, left: 0, leftNames: [] as string[] };
  if (!batchId) return result;
  const db = await getDb();
  if (!db) return result;
  const batch = await getBatchById(batchId);
  if (!batch || batch.shippingType !== "sea") return result;

  const parcels = await db
    .select()
    .from(packages)
    .where(and(
      eq(packages.batchId, batchId),
      ...(customerId ? [eq(packages.customerId, customerId)] : []),
      eq(packages.isUnclaimed, false),
      notInArray(packages.status, ["returned", "cancelled"]),
    ));

  const reason = smallParcelRuleOn(batch)
    ? `بەریدی بچووک لە باچی ${batch.batchCode} کرایەوە`
    : `بەریدی بچووک لە باچی ${batch.batchCode} کوژایەوە`;

  for (const pkg of parcels) {
    if (exceptPackageId && pkg.id === exceptPackageId) continue;
    try {
      // A receipt is settled: skipped before anything is asked of it.
      const hold = await parcelMoneyHold(pkg.id);
      if (hold?.kind === "receipt") {
        const due = await shippingChargeDueNow(pkg);
        const stands = Number(pkg.calculatedCostUsd ?? 0) || 0;
        if (due.due && Math.abs(due.amount - stands) >= 0.005) {
          result.left += 1;
          result.leftNames.push(pkg.trackingNumber || pkg.packageCode);
        }
        continue;
      }
      if ((await repriceOne(pkg, actor, reason)) === "changed") result.changed += 1;
    } catch (e) {
      result.left += 1;
      result.leftNames.push(pkg.trackingNumber || pkg.packageCode);
      appLogger.warn("[SmallParcel] a parcel was left as it was", {
        packageId: pkg.id,
        batchId,
        error: e instanceof Error ? e.message.slice(0, 200) : String(e),
      });
    }
  }
  return result;
}

/** The old name, kept for the callers that still say it: the same work. */
export const rebalanceSmallParcels = repriceSmallParcels;

/**
 * «بێ زیادە بۆ ئەم پاکەتە» ticked or unticked on one parcel: the flag is set
 * and that parcel alone re-priced, in place on its own ledger row. A parcel
 * whose box is receipted is refused with the cause and the cure, and nothing
 * is changed.
 */
export async function setSmallParcelWaiver(
  packageId: number,
  waived: boolean,
  actor: Actor,
): Promise<{ changed: boolean; wasUsd: number; nowUsd: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1);
  if (!pkg) {
    throw new Error(withFix("ئەم پاکەتە نەدۆزرایەوە.", ["لاپەڕەکە نوێ بکەرەوە", "بە تراکەکەی بگەڕێ"]));
  }
  const name = pkg.trackingNumber || pkg.packageCode;
  const wasUsd = Number(pkg.calculatedCostUsd ?? 0) || 0;
  if (Boolean(pkg.smallParcelWaived) === waived) return { changed: false, wasUsd, nowUsd: wasUsd };

  const hold = await parcelMoneyHold(packageId);
  if (hold?.kind === "receipt") {
    throw new Error(withFix(
      `زیادەی بەریدی بچووکی پاکەتی ${name} ناگۆڕدرێت: پارەکەی لە وەسڵی ${hold.settlementNumber} ـی بۆکسی ${hold.boxCode ?? ""} وەرگیراوە، و بۆکسی واسڵکراو تەواو بووە.`,
      [
        "ئەگەر بەڕاستی دەبێت بگۆڕدرێت، ئادمینی سەرەکی بۆکسەکە بە هۆکارەوە دەکاتەوە",
        "ئینجا زیادەکە لێرە بگۆڕە و بۆکسەکە دووبارە واسڵ بکەرەوە",
      ],
    ));
  }

  await db.update(packages).set({ smallParcelWaived: waived }).where(eq(packages.id, packageId));
  try {
    const fresh = { ...pkg, smallParcelWaived: waived };
    const reason = waived
      ? `بەریدی بچووک: زیادە لە پاکەتی ${name} لابرا (بە دەست)`
      : `بەریدی بچووک: زیادە بۆ پاکەتی ${name} گەڕایەوە`;
    const outcome = await repriceOne(fresh, actor, reason);
    const [after] = await db.select({ c: packages.calculatedCostUsd }).from(packages).where(eq(packages.id, packageId)).limit(1);
    return { changed: outcome === "changed", wasUsd, nowUsd: Number(after?.c ?? 0) || 0 };
  } catch (e) {
    // The price could not follow: the box goes back to how it was.
    await db.update(packages).set({ smallParcelWaived: pkg.smallParcelWaived ?? null }).where(eq(packages.id, packageId));
    throw e;
  }
}
