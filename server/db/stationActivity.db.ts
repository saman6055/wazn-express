/**
 * What the four scan stations did, read from each one's own event
 * (shared/stationActivity). Read only.
 */
import { and, eq, gte, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { auditLogs, packageScans, packages, users } from "../../drizzle/schema";
import { summarizeStations, type StationEvent, type StationSummary } from "@shared/stationActivity";
import { parcelsLeftOutOfBoxes } from "./boxMissing.db";

export interface StationActivity extends StationSummary {
  byUser: Array<{ userId: number; count: number; name: string }>;
  waiting: {
    /** Same rule as the «بێ باچ» tab of All Packages: no batch, not delivered or cancelled. */
    noBatch: number;
    /** Arrived and in no box after 3 days: the same rows as the problems page. */
    leftOut: number;
  };
}

const toDate = (v: unknown) => (v instanceof Date ? v : new Date(String(v)));

export async function getStationActivity(days = 7): Promise<StationActivity | null> {
  const db = await getDb();
  if (!db) return null;
  const now = Date.now();
  // One day more than shown, so "yesterday until now" is always inside the window.
  const since = new Date(now - (days + 1) * 86_400_000);

  const [registered, batched, arrived, delivered] = await Promise.all([
    db.select({ at: packages.registeredAt, userId: packages.registeredById }).from(packages).where(gte(packages.registeredAt, since)),
    db.select({ at: auditLogs.createdAt, userId: auditLogs.userId }).from(auditLogs).where(and(eq(auditLogs.action, "assign_package_to_batch"), gte(auditLogs.createdAt, since))),
    db.select({ at: packageScans.scannedAt, userId: packageScans.scannedById }).from(packageScans).where(and(eq(packageScans.scanType, "received_local"), gte(packageScans.scannedAt, since))),
    db.select({ at: packages.deliveredAt, userId: packages.deliveredById }).from(packages).where(and(isNotNull(packages.deliveredAt), gte(packages.deliveredAt, since))),
  ]);

  const events: StationEvent[] = [
    ...registered.map((r) => ({ station: "registered" as const, at: toDate(r.at), userId: r.userId ?? null })),
    ...batched.map((r) => ({ station: "in_batch" as const, at: toDate(r.at), userId: r.userId ?? null })),
    ...arrived.map((r) => ({ station: "received_local" as const, at: toDate(r.at), userId: r.userId ?? null })),
    ...delivered.map((r) => ({ station: "delivered" as const, at: toDate(r.at!), userId: r.userId ?? null })),
  ];
  const summary = summarizeStations(events, now, days);

  const ids = summary.byUser.map((u) => u.userId);
  const names = ids.length
    ? new Map((await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids))).map((u) => [Number(u.id), u.name ?? ""]))
    : new Map<number, string>();

  const [noBatchRow] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(packages)
    .where(and(isNull(packages.batchId), notInArray(packages.status, ["delivered", "cancelled"])));
  const leftOut = (await parcelsLeftOutOfBoxes()).reduce((n, c) => n + c.parcels.length, 0);

  return {
    ...summary,
    byUser: summary.byUser.map((u) => ({ ...u, name: names.get(u.userId) || `#${u.userId}` })),
    waiting: { noBatch: Number(noBatchRow?.n) || 0, leftOut },
  };
}
