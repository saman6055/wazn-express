import { and, eq, notInArray } from "drizzle-orm";
import { getDb } from "./connection";
import { packages } from "../../drizzle/schema";
import { getBatchById } from "./batches.db";
import { shippingChargeDueNow } from "./batchCharging.db";
import { applyParcelCorrection } from "./parcelCorrection.db";
import { customerSeaCbmInBatch, smallParcelRuleOn } from "./smallParcel.db";
import { appLogger } from "../utils/logger";

/**
 * The earlier parcels of one customer in one sea batch, put right as the
 * customer's total changes.
 *
 * The owner, 2026-10-18, of the small-parcel rule measuring everything a
 * person has in the batch: «هەر جارێک کارتۆنێکی نوێ بۆ هەمان کەس لە هەمان
 * باچدا تۆمار دەکرێت، سیستەم کۆکە دووبارە دەژمێرێتەوە و نرخی کارتۆنەکانی
 * پێشووش خۆکار ڕاست دەکاتەوە» - «زۆر بیرۆکەیەکی دادپەروەرانەیە».
 *
 * Each parcel whose charge no longer reads what it should is corrected
 * through the one correction there is (applyParcelCorrection): on its own
 * ledger row, with its invoice line and revenue following, recorded for the
 * bell. Nothing is forced past that door's guards:
 *
 *   - a parcel in a box or on a receipt is left alone - its money is settled
 *     where it was paid;
 *   - a lowering that would leave the customer in credit is left for the main
 *     admin (the finance framework: credit only by his yes);
 *
 * and neither stops the work that called this: a registration, a correction
 * or the box on the batch form never fails because a sibling could not move.
 */
export async function rebalanceSmallParcels(
  batchId: number | null | undefined,
  customerId: number | null | undefined,
  actor: { id: number; role?: string | null },
  /** The parcel just written or corrected: it is already right. */
  exceptPackageId?: number | null,
): Promise<{ changed: number; left: number }> {
  const result = { changed: 0, left: 0 };
  if (!batchId || !customerId) return result;
  const db = await getDb();
  if (!db) return result;
  const batch = await getBatchById(batchId);
  if (!batch || batch.shippingType !== "sea") return result;

  const parcels = await db
    .select()
    .from(packages)
    .where(and(
      eq(packages.batchId, batchId),
      eq(packages.customerId, customerId),
      eq(packages.isCharged, true),
      eq(packages.isUnclaimed, false),
      notInArray(packages.status, ["returned", "cancelled"]),
    ));
  if (parcels.length === 0) return result;

  const total = await customerSeaCbmInBatch(batchId, customerId);
  const ruleWord = smallParcelRuleOn(batch)
    ? `کۆی بارەکانی ئەم کڕیارە لە باچی ${batch.batchCode} ئێستا ${total.toFixed(3)} m³ـە`
    : `یاسای بەریدی بچووک لە باچی ${batch.batchCode} لابرا`;

  for (const pkg of parcels) {
    if (exceptPackageId && pkg.id === exceptPackageId) continue;
    try {
      const due = await shippingChargeDueNow(pkg);
      if (!due.due) continue;
      const stands = Number(pkg.calculatedCostUsd ?? 0) || 0;
      if (Math.abs(due.amount - stands) < 0.005) continue;
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
        `بەریدی بچووک: ${ruleWord} — نرخی پاکەتی ${name} لە $${stands.toFixed(2)} بوو بە $${due.amount.toFixed(2)}`,
        { allowCredit: false, actorRole: actor.role ?? null },
      );
      result.changed += 1;
    } catch (e) {
      result.left += 1;
      appLogger.warn("[SmallParcel] a parcel was left as it was", {
        packageId: pkg.id,
        batchId,
        customerId,
        error: e instanceof Error ? e.message.slice(0, 200) : String(e),
      });
    }
  }
  return result;
}
