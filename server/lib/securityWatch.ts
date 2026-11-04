import { and, eq, isNull } from "drizzle-orm";
import { customers } from "../../drizzle/schema";
import { getDb } from "../db/connection";
import { appLogger } from "../utils/logger";
import {
  crossedLine,
  KIND_WORDS,
  WATCH_WINDOW_MS,
  type SecurityHoldReport,
  type SuspiciousEvent,
  type SuspiciousKind,
} from "@shared/securityWatch";

/**
 * Watching customer sessions for what the portal never does, and holding the
 * account the moment a line is crossed (shared/securityWatch says which).
 *
 * Kept in memory for the ten-minute window: a restart forgets a half-counted
 * run, which only ever errs towards the customer. A hold itself is on the
 * customer's row, so it survives everything until the main admin lifts it.
 */
const recent = new Map<number, SuspiciousEvent[]>();
const holding = new Set<number>();

interface RequestLike {
  ip?: string;
  headers?: Record<string, unknown>;
}

/** One suspicious thing a customer's session did. Never throws, never waits. */
export function noteSuspicious(customerId: number, kind: SuspiciousKind, path: string, req?: RequestLike): void {
  try {
    const now = Date.now();
    const list = (recent.get(customerId) ?? []).filter((e) => now - e.at <= WATCH_WINDOW_MS);
    list.push({
      at: now,
      kind,
      path: String(path || "?").slice(0, 120),
      ip: String(req?.ip ?? "").slice(0, 64),
      agent: String(req?.headers?.["user-agent"] ?? "").slice(0, 200),
    });
    recent.delete(customerId);
    recent.set(customerId, list.slice(-200));
    for (const key of Array.from(recent.keys())) {
      if (recent.size <= 5000) break;
      recent.delete(key);
    }
    const crossed = crossedLine(list, now);
    if (crossed && !holding.has(customerId)) {
      holding.add(customerId);
      void holdCustomer(customerId, crossed, list).finally(() => holding.delete(customerId));
    }
  } catch (err) {
    appLogger.warn("[security] could not note an event", { error: err instanceof Error ? err.message : String(err) });
  }
}

/** Hold the account: every session ends on its next request, and sign-in refuses. */
export async function holdCustomer(customerId: number, kind: SuspiciousKind, events: SuspiciousEvent[]): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  const report: SecurityHoldReport = { kind, summary: KIND_WORDS[kind], events: events.slice(-40) };
  const [result] = await database
    .update(customers)
    .set({ securityBlockedAt: new Date(), securityBlockReport: JSON.stringify(report) })
    .where(and(eq(customers.id, customerId), isNull(customers.securityBlockedAt)));
  if (Number((result as { affectedRows?: number })?.affectedRows ?? 0) === 0) return false;
  recent.delete(customerId);
  const last = events[events.length - 1];
  appLogger.warn("[security] customer held", { customerId, kind, events: events.length, ip: last?.ip });

  const db = await import("../db");
  await db.logCustomerActivity({
    customerId,
    action: "security_hold",
    category: "auth",
    detail: KIND_WORDS[kind].slice(0, 500),
    metadata: { kind, events: events.length, paths: Array.from(new Set(events.map((e) => e.path))).slice(0, 20) },
    ipAddress: last?.ip || null,
    userAgent: last?.agent || null,
  });
  await db.createActivityAlert({
    action: "customer_security_hold",
    category: "security",
    entityType: "customer",
    entityId: customerId,
    customTitle: "کڕیارێک بۆ پاراستن ڕاگیرا",
    customMessage: `${KIND_WORDS[kind]} — ${events.length} جار لە 10 خولەکدا. ئادمینی سەرەکی لە «پاراستنی سیستەم» دەتوانێت بیکاتەوە.`,
    severity: "critical",
  });
  return true;
}

/** The main admin lifts a hold, after asking the customer. */
export async function clearCustomerHold(customerId: number, by: { id: number; role: string }): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  const [result] = await database
    .update(customers)
    .set({ securityBlockedAt: null, securityBlockReport: null })
    .where(eq(customers.id, customerId));
  recent.delete(customerId);
  const db = await import("../db");
  await db.createAuditLog({ userId: by.id, userRole: by.role, action: "clear_security_hold", entityType: "customer", entityId: customerId });
  await db.logCustomerActivity({ customerId, action: "security_hold_cleared", category: "auth", metadata: { by: by.id } });
  return Number((result as { affectedRows?: number })?.affectedRows ?? 0) > 0;
}

/** Tests only. */
export function resetSecurityWatch(): void {
  recent.clear();
  holding.clear();
}
