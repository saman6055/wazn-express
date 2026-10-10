import { withFix } from "@shared/fixAdvice";
import { sameList, seenList, type CorrectAllResult, type SeenList } from "@shared/boxDoubleChargeAll";
import { appLogger } from "../utils/logger";
import { correctBoxDoubleCharge, findBoxDoubleCharges } from "./boxPaidStillOwed.db";

/**
 * Put every customer with a false debt right, at the main admin's one yes
 * (shared/boxDoubleChargeAll). Nothing new is decided here: the list is the
 * finder's, each correction is correctBoxDoubleCharge's - which looks at the
 * customer again itself before it takes anything off.
 */
export async function correctAllBoxDoubleCharges(seen: SeenList, userId: number): Promise<CorrectAllResult> {
  const now = (await findBoxDoubleCharges()).filter((c) => c.falseDebtUsd > 0.005);
  if (now.length === 0) {
    throw new Error(withFix("هیچ قەرزێکی دووجار نووسراو نەماوە.", ["پەڕەکە نوێ بکەوە"]));
  }
  if (!sameList(seen, seenList(now))) {
    throw new Error(withFix(
      "لیستەکە لەو کاتەوەی بینیت گۆڕاوە — هیچ شتێک ڕاست نەکرایەوە.",
      ["پەڕەکە نوێ بکەوە", "لیستە نوێیەکە و کۆی بڕەکەی ببینە", "ئینجا دووبارە «هەمووی ڕاست بکەوە» لێبدە"],
    ));
  }

  const result: CorrectAllResult = { corrected: 0, removedUsd: 0, failed: [] };
  for (const customer of now) {
    try {
      const done = await correctBoxDoubleCharge(customer.customerId, userId);
      result.corrected += 1;
      result.removedUsd = Math.round((result.removedUsd + done.removedUsd) * 100) / 100;
    } catch (err) {
      result.failed.push({ customerId: customer.customerId, customerCode: customer.customerCode, message: err instanceof Error ? err.message : String(err) });
    }
  }
  appLogger.info("[BoxDoubleCharge] corrected all", { corrected: result.corrected, removedUsd: result.removedUsd, failed: result.failed.length, userId });
  return result;
}
