import { appLogger } from "../utils/logger";
import { ENV } from "./env";
import { notifyOwner } from "./notification";

/**
 * Deliver a scheduled alert to whoever is actually reachable.
 *
 * The background schedulers — orders still waiting on a tracking number,
 * delivery boxes left open too long — were written to call `notifyOwner`,
 * which posts to the Manus notification service. That service is not
 * configured on this install and never has been, so both schedulers have been
 * failing on every run since they were written:
 *
 *   [Tracking Alerts] Error checking and notifying
 *   [Open Boxes] Check failed
 *
 * Nobody saw either error, because a third bug was filling the log with
 * hundreds of false warnings at the same time. Two features that look
 * implemented have in practice never told anyone anything.
 *
 * The activity feed is the channel that works: it is in the database, the
 * portal centre already renders it, and staff already read it. Use the
 * external service when it is configured, and the feed either way — an alert
 * that reaches a screen beats one that reaches an endpoint nobody set up.
 */
export async function notifyStaffAlert(params: {
  /** Stable identifier for the kind of alert, used by the activity feed. */
  action: string;
  category: string;
  title: string;
  content: string;
  severity?: "info" | "warning" | "critical";
}): Promise<void> {
  const { action, category, title, content, severity = "warning" } = params;

  // Always record it where somebody will see it.
  try {
    const { createActivityAlert } = await import("../db/admin.db");
    await createActivityAlert({
      action,
      category,
      severity,
      customTitle: title,
      // The feed shows one message; the scheduler's body is already written
      // for a human, so pass it through rather than re-summarising it.
      customMessage: content,
    });
  } catch (err) {
    appLogger.error("[Alert] Could not record the alert for staff", {
      action,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // And forward it outward only when that is actually set up. Calling an
  // unconfigured service just to log the same failure every hour is noise
  // that hides the failures that matter.
  if (!ENV.forgeApiUrl?.trim() || !ENV.forgeApiKey?.trim()) return;

  try {
    await notifyOwner({ title, content });
  } catch (err) {
    appLogger.warn("[Alert] External notification failed; the staff feed still has it", {
      action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
