import * as db from "../db";
import { cacheInvalidate } from "../db/cache";

/**
 * One yuan rate for the whole business (owner's decision, 2026-09-19).
 *
 * There were two. The office's RMB rate — Settings → Currency, and the
 * accounting page — is what an order's yuan price is converted at, and what
 * invoices and expenses carry. The Portal Center's yuan-buying rate was the
 * price a customer buys yuan at, stored on its own. A customer read ¥6.85 on
 * the home screen and another number on the page where they buy yuan.
 *
 * Now the office's list of rates is the only place the rate lives, and both
 * screens edit it: a change in the Portal Center is a new entry in that list,
 * with who made it and when, exactly as Settings makes one; a change in
 * Settings is what the customer's yuan page shows next. Nothing is copied, so
 * the two cannot drift apart again.
 *
 * The Portal Center's own stored rate is kept only as the fallback for an
 * installation with no RMB rate at all.
 */

/** The office's current RMB rate — yuan per 1 US dollar — or null when none is set. */
export async function currentRmbRate(): Promise<number | null> {
  const row = await db.getCurrentExchangeRate("RMB");
  const rate = Number(row?.rate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** The yuan-buying settings, carrying the one shared rate. */
export async function yuanSettingsWithSharedRate(): Promise<db.YuanExchangeSettings> {
  const [settings, shared] = await Promise.all([db.getYuanExchangeSettings(), currentRmbRate()]);
  return shared != null ? { ...settings, rate: shared } : settings;
}

/**
 * Record a new RMB rate from the Portal Center: the same entry Settings
 * writes, the same audit line, and the cached lists the order forms read are
 * dropped so they see it at once. Nothing is written when the rate has not
 * changed — saving the yuan page's other settings must not add a rate to the
 * history. Returns whether an entry was made.
 */
export async function recordRmbRateFromPortalCenter(
  rate: number,
  user: { id: number; role: Parameters<typeof db.createAuditLog>[0]["userRole"] },
): Promise<boolean> {
  const current = await currentRmbRate();
  if (current != null && Math.abs(current - rate) < 1e-9) return false;
  const entry = await db.createExchangeRate({
    targetCurrency: "RMB",
    rate: String(rate),
    isManualOverride: true,
    source: "manual",
    createdById: user.id,
  });
  await db.createAuditLog({
    userId: user.id,
    userRole: user.role,
    action: "create_exchange_rate",
    entityType: "exchange_rate",
    entityId: entry.id,
    newValues: { targetCurrency: "RMB", rate: String(rate), from: "portal_center" },
  });
  cacheInvalidate(["exchangeRates:all", "exchangeRate:RMB"]);
  return true;
}
