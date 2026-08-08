import webpush from "web-push";
import { getConfig } from "../config";
import { appLogger } from "../utils/logger";
import * as db from "../db";
import type { PushNotificationCampaign } from "../../drizzle/schema";

let initialized = false;
let enabled = false;

function ensureInit(): boolean {
  if (initialized) return enabled;
  initialized = true;

  const cfg = getConfig();
  if (!cfg.vapidPublicKey || !cfg.vapidPrivateKey) {
    appLogger.warn("[Push] VAPID keys not configured; web push disabled");
    enabled = false;
    return false;
  }

  webpush.setVapidDetails(
    cfg.vapidSubject || "mailto:admin@waznexpress.com",
    cfg.vapidPublicKey,
    cfg.vapidPrivateKey
  );
  enabled = true;
  return true;
}

export function isPushEnabled(): boolean {
  return ensureInit();
}

export function getVapidPublicKey(): string | null {
  if (!ensureInit()) return null;
  return getConfig().vapidPublicKey || null;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export async function sendPushToCustomer(
  customerId: number,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!ensureInit()) return { sent: 0, failed: 0, removed: 0 };

  const subs = await db.getActivePushSubscriptionsForCustomer(customerId);
  if (subs.length === 0) return { sent: 0, failed: 0, removed: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/portal",
    tag: payload.tag,
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
        { TTL: 24 * 60 * 60 }
      );
      await db.markPushSubscriptionUsed(sub.id);
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      const expired = statusCode === 404 || statusCode === 410;
      if (expired) {
        // This one is ours, not a customer request: the push service told us
        // the endpoint is gone, and we already know whose row it is.
        await db.deletePushSubscriptionByEndpoint(sub.endpoint, sub.customerId);
        removed += 1;
      } else {
        const deactivate = sub.failureCount >= 4;
        await db.incrementPushSubscriptionFailure(sub.id, deactivate);
        failed += 1;
      }
      appLogger.warn("[Push] send failed", {
        subscriptionId: sub.id,
        statusCode,
        expired,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }));

  return { sent, failed, removed };
}

/**
 * Multilingual payload picker — pick the right title/body based on the
 * subscriber's saved language. Falls back gracefully if missing.
 */
function pickLocalized(
  language: string | null | undefined,
  ku?: string | null,
  en?: string | null,
  ar?: string | null,
  zh?: string | null,
): string {
  const lang = (language || "").toLowerCase().slice(0, 2);
  const map: Record<string, string | null | undefined> = { ku, en, ar, zh };
  return map[lang] || ku || en || ar || zh || "";
}

/**
 * Run a campaign: resolve recipients, send to each (using their preferred language
 * where available), update counters atomically. Used by both immediate "send now"
 * and the scheduled-campaigns cron tick.
 */
export async function runPushCampaign(campaignId: number): Promise<{
  ok: boolean;
  totalRecipients: number;
  sent: number;
  failed: number;
  removed: number;
  error?: string;
}> {
  const campaign = await db.getPushCampaignById(campaignId);
  if (!campaign) {
    return { ok: false, totalRecipients: 0, sent: 0, failed: 0, removed: 0, error: "campaign_not_found" };
  }

  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    return { ok: false, totalRecipients: 0, sent: 0, failed: 0, removed: 0, error: `bad_status:${campaign.status}` };
  }

  if (!ensureInit()) {
    await db.updatePushCampaign(campaignId, { status: "failed", errorMessage: "push_disabled (VAPID keys missing)" });
    return { ok: false, totalRecipients: 0, sent: 0, failed: 0, removed: 0, error: "push_disabled" };
  }

  // Mark as sending
  await db.updatePushCampaign(campaignId, { status: "sending", startedAt: new Date(), errorMessage: null });

  try {
    const customerIds = await db.resolvePushTargetCustomerIds({
      targetType: campaign.targetType,
      targetCustomerId: campaign.targetCustomerId,
      targetBatchId: campaign.targetBatchId,
      targetSegment: campaign.targetSegment,
    });

    if (customerIds.length === 0) {
      await db.updatePushCampaign(campaignId, {
        status: "completed",
        completedAt: new Date(),
        totalRecipients: 0,
      });
      return { ok: true, totalRecipients: 0, sent: 0, failed: 0, removed: 0 };
    }

    let totalSent = 0;
    let totalFailed = 0;
    let totalRemoved = 0;

    // Process in chunks of 50 to keep memory + connection load steady
    const CHUNK = 50;
    for (let i = 0; i < customerIds.length; i += CHUNK) {
      const slice = customerIds.slice(i, i + CHUNK);
      await Promise.all(slice.map(async (cid) => {
        const subs = await db.getActivePushSubscriptionsForCustomer(cid);
        if (subs.length === 0) return;

        // Pick the best language from the FIRST subscription's saved language —
        // typically a customer has one device. (For multi-device we still use
        // the first sub's locale as the "primary" hint.)
        const lang = subs[0]?.language || "ku";
        const title = pickLocalized(lang, campaign.titleKu, campaign.titleEn, campaign.titleAr, campaign.titleZh);
        const body = pickLocalized(lang, campaign.bodyKu, campaign.bodyEn, campaign.bodyAr, campaign.bodyZh);
        if (!title || !body) return;

        const result = await sendPushToCustomer(cid, {
          title,
          body,
          url: campaign.url || "/portal",
          tag: `campaign-${campaignId}`,
          data: { campaignId },
        });
        totalSent += result.sent;
        totalFailed += result.failed;
        totalRemoved += result.removed;
      }));
    }

    await db.updatePushCampaign(campaignId, {
      status: "completed",
      completedAt: new Date(),
      totalRecipients: customerIds.length,
      sentCount: totalSent,
      failedCount: totalFailed,
      expiredRemovedCount: totalRemoved,
    });

    return { ok: true, totalRecipients: customerIds.length, sent: totalSent, failed: totalFailed, removed: totalRemoved };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appLogger.error("[Push] campaign run failed", { campaignId, message: msg });
    await db.updatePushCampaign(campaignId, { status: "failed", errorMessage: msg.slice(0, 1000) });
    return { ok: false, totalRecipients: 0, sent: 0, failed: 0, removed: 0, error: msg };
  }
}

/**
 * Cron tick: find campaigns whose scheduledAt has elapsed and run them.
 * Safe to call frequently — idempotent because runPushCampaign() rejects
 * non-(draft|scheduled) campaigns.
 */
export async function processDueScheduledCampaigns(): Promise<{ processed: number; results: { campaignId: number; ok: boolean }[] }> {
  if (!ensureInit()) return { processed: 0, results: [] };
  const due = await db.getDuePushCampaigns(new Date());
  const results: { campaignId: number; ok: boolean }[] = [];
  for (const c of due) {
    const r = await runPushCampaign(c.id);
    results.push({ campaignId: c.id, ok: r.ok });
  }
  return { processed: due.length, results };
}

// Re-export for type-only consumers
export type { PushNotificationCampaign };

// ============ SCHEDULER ============
let scheduledCampaignsInterval: NodeJS.Timeout | null = null;

/**
 * Start the background poller that fires `processDueScheduledCampaigns()` every
 * 60 seconds. Cheap query (one indexed scan on `status='scheduled' AND scheduledAt<=now`).
 * Called once from startServer().
 */
export function startScheduledCampaignsPoller(): void {
  if (scheduledCampaignsInterval) {
    clearInterval(scheduledCampaignsInterval);
    scheduledCampaignsInterval = null;
  }

  scheduledCampaignsInterval = setInterval(async () => {
    try {
      const r = await processDueScheduledCampaigns();
      if (r.processed > 0) {
        appLogger.info("[Push] processed scheduled campaigns", r);
      }
    } catch (err) {
      appLogger.error("[Push] scheduler tick failed", { message: err instanceof Error ? err.message : String(err) });
    }
  }, 60 * 1000);
}

export function stopScheduledCampaignsPoller(): void {
  if (scheduledCampaignsInterval) {
    clearInterval(scheduledCampaignsInterval);
    scheduledCampaignsInterval = null;
  }
}
