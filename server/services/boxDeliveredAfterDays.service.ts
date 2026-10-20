import * as db from "../db";
import { appLogger } from "../utils/logger";

/**
 * The owner, 2026-10-20: «کاتێ بۆکس دروست کرا دوای 3 رۆژ ببێتە گەیەنرا
 * ئەگەر بە مەنوەلی بۆی نەکرا». Every hour, the parcels inside a box made
 * three days ago or more are marked delivered (server/db/boxMissing.db.ts:
 * deliverParcelsOfOldBoxes) - status and date only, nothing else.
 */
async function runOnce(): Promise<void> {
  try {
    const delivered = await db.deliverParcelsOfOldBoxes();
    if (delivered > 0) appLogger.info("[Box 3 days] parcels marked delivered", { delivered });
  } catch (error) {
    appLogger.error("[Box 3 days] check failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

let interval: NodeJS.Timeout | null = null;

export async function scheduleBoxDeliveredAfterDays(): Promise<void> {
  if (interval) clearInterval(interval);
  interval = setInterval(() => void runOnce(), 60 * 60 * 1000);
  await runOnce();
}

export function stopBoxDeliveredAfterDays(): void {
  if (interval) clearInterval(interval);
  interval = null;
}
