import { auditRiskItems, type RiskItem } from "@shared/riskBell";
import { cacheGet, cacheSet } from "../db/cache";
import { runSweep } from "../services/auditSweep.service";
import { appLogger } from "../utils/logger";

/**
 * The auditor's findings for the bell (owner, 2026-09-17: the bell is the
 * system's sensor — "anything incomplete, any error, any risk" shows there).
 *
 * The sweep is eighteen aggregate queries run one after another, and the bell
 * asks every five minutes for every person at a desk. So the sweep runs at
 * most once every fifteen minutes for everybody, and no bell ever waits on
 * it: until a run has finished, the bell answers with the standing risks
 * alone, and the findings join on its next refresh.
 *
 * Read-only, like the sweep itself.
 */

const KEY = "dashboard:audit-risks";

/** How long one sweep's findings stand before the next run. */
export const AUDIT_RISKS_TTL_MS = 15 * 60_000;

/** The longest a bell waits for a sweep that is running. */
const WAIT_MS = 1_500;

let running: Promise<RiskItem[]> | null = null;

export async function auditRisks(): Promise<RiskItem[]> {
  const cached = cacheGet<RiskItem[]>(KEY);
  if (cached) return cached;

  if (!running) {
    running = runSweep()
      .then((results) => {
        const items = auditRiskItems(results);
        cacheSet(KEY, items, AUDIT_RISKS_TTL_MS);
        return items;
      })
      .catch((error) => {
        appLogger.error("auditRisks: the sweep failed", { error: error instanceof Error ? error.message : String(error) });
        // Try again in a minute rather than on every bell.
        cacheSet(KEY, [], 60_000);
        return [] as RiskItem[];
      })
      .finally(() => {
        running = null;
      });
  }

  return Promise.race([running, new Promise<RiskItem[]>((resolve) => setTimeout(() => resolve([]), WAIT_MS))]);
}
