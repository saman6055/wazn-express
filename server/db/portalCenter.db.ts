import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  customers,
  customerDeclaredPackages,
  packageClaimRequests,
  customerMessages,
  customerActivityLog,
  customerAdminNotes,
  deliveryRatings,
  packages,
} from "../../drizzle/schema";
import type {
  InsertCustomerActivityLog,
  InsertCustomerAdminNote,
} from "../../drizzle/schema/portalActivity.schema";

// ---------------------------------------------------------------------------
// Customer Portal Center — read models + activity capture.
// Everything here is additive observability. The two write helpers
// (logCustomerActivity, updateCustomerLastSignedIn) are best-effort: a failure
// must never break the customer's real action, so they swallow their errors.
// ---------------------------------------------------------------------------

/** Record one portal action. Best-effort — never throws to the caller. */
export async function logCustomerActivity(
  data: InsertCustomerActivityLog,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(customerActivityLog).values(data);
  } catch {
    // Observability must never block the customer's real action.
  }
}

/** Add an internal staff note about a customer. */
export async function addCustomerAdminNote(data: InsertCustomerAdminNote): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(customerAdminNotes).values(data);
}

/** List internal staff notes for a customer, newest first. */
export async function listCustomerAdminNotes(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return safe(
    db.select()
      .from(customerAdminNotes)
      .where(eq(customerAdminNotes.customerId, customerId))
      .orderBy(desc(customerAdminNotes.createdAt))
      .limit(50),
    [],
  );
}

// ---- Delivery ratings -------------------------------------------------------

/** The customer's most recent delivered package (last 14 days) with no rating yet. */
export async function getRatablePackage(customerId: number) {
  const db = await getDb();
  if (!db) return null;
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const rows = await safe(db
    .select({
      id: packages.id,
      trackingNumber: packages.trackingNumber,
      packageCode: packages.packageCode,
      deliveredAt: packages.deliveredAt,
      description: packages.description,
      photos: packages.photos,
    })
    .from(packages)
    .leftJoin(deliveryRatings, eq(deliveryRatings.packageId, packages.id))
    .where(
      and(
        eq(packages.customerId, customerId),
        // Scanners store "Delivered", updatePackage stores "delivered".
        sql`LOWER(${packages.status}) = 'delivered'`,
        sql`${packages.deliveredAt} >= ${cutoff}`,
        sql`${deliveryRatings.id} IS NULL`,
      ),
    )
    .orderBy(desc(packages.deliveredAt))
    .limit(1), []);
  return rows[0] ?? null;
}

/** Save a rating; ownership must be verified by the caller. Idempotent per package. */
export async function createDeliveryRating(data: {
  customerId: number;
  packageId: number;
  rating: number;
  comment?: string | null;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(deliveryRatings).values({
      customerId: data.customerId,
      packageId: data.packageId,
      rating: Math.min(5, Math.max(1, Math.round(data.rating))),
      comment: data.comment?.slice(0, 1000) || null,
    });
    return true;
  } catch {
    return false; // duplicate (already rated) or transient failure
  }
}

/** Admin: paginated ratings with customer + package identity, plus the average. */
export async function listDeliveryRatings(opts: { page: number; pageSize: number }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, average: null as number | null };

  const [{ total, average }] = await safe(
    db.select({ total: sql<number>`count(*)`, average: sql<number>`avg(${deliveryRatings.rating})` })
      .from(deliveryRatings),
    // avg() is typed number but is NULL on an empty table anyway; the caller
    // null-checks it, so the fallback mirrors that runtime shape.
    [{ total: 0, average: null as unknown as number }],
  );

  const data = await safe(
    db.select({
      id: deliveryRatings.id,
      rating: deliveryRatings.rating,
      comment: deliveryRatings.comment,
      createdAt: deliveryRatings.createdAt,
      customerId: deliveryRatings.customerId,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      trackingNumber: packages.trackingNumber,
    })
      .from(deliveryRatings)
      .leftJoin(customers, eq(deliveryRatings.customerId, customers.id))
      .leftJoin(packages, eq(deliveryRatings.packageId, packages.id))
      .orderBy(desc(deliveryRatings.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    [],
  );

  return { data, total: num(total), average: average != null ? Number(average) : null };
}

/** Stamp a customer's last portal login. Best-effort. */
export async function updateCustomerLastSignedIn(
  customerId: number,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db
      .update(customers)
      .set({ lastSignedIn: new Date() })
      .where(eq(customers.id, customerId));
  } catch {
    // ignore
  }
}

const num = (v: unknown) => Number(v ?? 0);

// Swallow a failing sub-query into a fallback so one missing table (e.g. a
// migration that hasn't run yet) degrades a panel instead of blanking it.
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

/** Top-of-page KPI counts for the Portal Center overview. */
export async function getPortalCenterOverview() {
  const db = await getDb();
  if (!db) {
    return {
      totalCustomers: 0, activeToday: 0, activeWeek: 0,
      pendingDeclares: 0, pendingClaims: 0,
      declaresWeek: 0, claimsWeek: 0, messagesWeek: 0,
    };
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const c = sql<number>`count(*)`;
  const distinctCust = sql<number>`count(distinct ${customerActivityLog.customerId})`;

  const [
    [totalCustomers],
    [activeToday],
    [activeWeek],
    [pendingDeclares],
    [pendingClaims],
    [declaresWeek],
    [claimsWeek],
    [messagesWeek],
  ] = await Promise.all([
    safe(db.select({ c }).from(customers).where(eq(customers.isActive, true)), [{ c: 0 }]),
    safe(db.select({ c: distinctCust }).from(customerActivityLog).where(sql`${customerActivityLog.createdAt} >= ${dayAgo}`), [{ c: 0 }]),
    safe(db.select({ c: distinctCust }).from(customerActivityLog).where(sql`${customerActivityLog.createdAt} >= ${weekAgo}`), [{ c: 0 }]),
    safe(db.select({ c }).from(customerDeclaredPackages).where(eq(customerDeclaredPackages.status, "pending")), [{ c: 0 }]),
    safe(db.select({ c }).from(packageClaimRequests).where(eq(packageClaimRequests.status, "pending")), [{ c: 0 }]),
    safe(db.select({ c }).from(customerDeclaredPackages).where(sql`${customerDeclaredPackages.createdAt} >= ${weekAgo}`), [{ c: 0 }]),
    safe(db.select({ c }).from(packageClaimRequests).where(sql`${packageClaimRequests.createdAt} >= ${weekAgo}`), [{ c: 0 }]),
    safe(db.select({ c }).from(customerMessages).where(and(eq(customerMessages.senderType, "customer"), sql`${customerMessages.createdAt} >= ${weekAgo}`)), [{ c: 0 }]),
  ]);

  return {
    totalCustomers: num(totalCustomers?.c),
    activeToday: num(activeToday?.c),
    activeWeek: num(activeWeek?.c),
    pendingDeclares: num(pendingDeclares?.c),
    pendingClaims: num(pendingClaims?.c),
    declaresWeek: num(declaresWeek?.c),
    claimsWeek: num(claimsWeek?.c),
    messagesWeek: num(messagesWeek?.c),
  };
}

/** Paginated portal-customer directory with per-customer activity summary. */
export async function listPortalCustomers(opts: {
  search?: string;
  page: number;
  pageSize: number;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const conds = [eq(customers.isActive, true)];
  if (opts.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    conds.push(
      or(
        like(customers.fullName, s),
        like(customers.customerCode, s),
        like(customers.mobileNumber, s),
      )!,
    );
  }
  const where = and(...conds);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(customers)
    .where(where);

  const rows = await db
    .select({
      id: customers.id,
      customerCode: customers.customerCode,
      fullName: customers.fullName,
      mobileNumber: customers.mobileNumber,
      serviceTypes: customers.serviceTypes,
      createdAt: customers.createdAt,
      lastSignedIn: customers.lastSignedIn,
    })
    .from(customers)
    .where(where)
    .orderBy(desc(customers.lastSignedIn), desc(customers.createdAt))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return { data: [], total: num(total) };

  // Each aggregate is individually `safe` so one missing table (e.g. the
  // activity log before its migration ran) can't blank the customer list.
  const [declares, claims, msgs, acts] = await Promise.all([
    safe(db.select({ customerId: customerDeclaredPackages.customerId, c: sql<number>`count(*)` })
      .from(customerDeclaredPackages)
      .where(inArray(customerDeclaredPackages.customerId, ids))
      .groupBy(customerDeclaredPackages.customerId), []),
    safe(db.select({ customerId: packageClaimRequests.customerId, c: sql<number>`count(*)` })
      .from(packageClaimRequests)
      .where(inArray(packageClaimRequests.customerId, ids))
      .groupBy(packageClaimRequests.customerId), []),
    safe(db.select({ customerId: customerMessages.customerId, c: sql<number>`count(*)` })
      .from(customerMessages)
      .where(and(inArray(customerMessages.customerId, ids), eq(customerMessages.senderType, "customer")))
      .groupBy(customerMessages.customerId), []),
    safe(db.select({ customerId: customerActivityLog.customerId, c: sql<number>`count(*)`, last: sql<string>`max(${customerActivityLog.createdAt})` })
      .from(customerActivityLog)
      .where(inArray(customerActivityLog.customerId, ids))
      .groupBy(customerActivityLog.customerId), []),
  ]);

  const byId = <T extends { customerId: number }>(arr: T[]) =>
    new Map(arr.map((a) => [a.customerId, a]));
  const dMap = byId(declares);
  const cMap = byId(claims);
  const mMap = byId(msgs);
  const aMap = byId(acts);

  const data = rows.map((r) => ({
    ...r,
    declaredCount: num(dMap.get(r.id)?.c),
    claimCount: num(cMap.get(r.id)?.c),
    messageCount: num(mMap.get(r.id)?.c),
    activityCount: num(aMap.get(r.id)?.c),
    lastActivityAt: aMap.get(r.id)?.last ?? null,
  }));

  return { data, total: num(total) };
}

export interface TimelineEntry {
  source: "activity" | "declaration" | "claim" | "message";
  category: string;
  action: string;
  detail: string | null;
  path?: string | null;
  status?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  at: Date | string;
}

/**
 * Unified per-customer activity timeline. Merges the forward-looking activity
 * log with the historical customer-authored tables (declarations, claims,
 * messages). Activity-log rows in those same categories are dropped so a recent
 * action isn't counted twice (once logged, once from its source table).
 */
export async function getCustomerActivityTimeline(
  customerId: number,
  limit = 150,
): Promise<TimelineEntry[]> {
  const db = await getDb();
  if (!db) return [];

  const [acts, declares, claims, msgs] = await Promise.all([
    safe(db.select().from(customerActivityLog)
      .where(eq(customerActivityLog.customerId, customerId))
      .orderBy(desc(customerActivityLog.createdAt)).limit(limit), []),
    safe(db.select().from(customerDeclaredPackages)
      .where(eq(customerDeclaredPackages.customerId, customerId))
      .orderBy(desc(customerDeclaredPackages.createdAt)).limit(limit), []),
    safe(db.select().from(packageClaimRequests)
      .where(eq(packageClaimRequests.customerId, customerId))
      .orderBy(desc(packageClaimRequests.createdAt)).limit(limit), []),
    safe(db.select().from(customerMessages)
      .where(and(eq(customerMessages.customerId, customerId), eq(customerMessages.senderType, "customer")))
      .orderBy(desc(customerMessages.createdAt)).limit(limit), []),
  ]);

  const feed: TimelineEntry[] = [
    // Keep only the log categories NOT already represented by source tables.
    ...acts
      .filter((a) => !["declaration", "claim", "message"].includes(a.category))
      .map((a) => ({
        source: "activity" as const,
        category: a.category,
        action: a.action,
        detail: a.detail ?? a.path ?? null,
        path: a.path,
        entityType: a.entityType,
        entityId: a.entityId,
        at: a.createdAt,
      })),
    ...declares.map((d) => ({
      source: "declaration" as const,
      category: "declaration",
      action: "declare_package",
      detail: d.trackingNumber + (d.productName ? ` · ${d.productName}` : ""),
      status: d.status,
      entityType: "declared_package",
      entityId: d.id,
      at: d.createdAt,
    })),
    ...claims.map((c) => ({
      source: "claim" as const,
      category: "claim",
      action: "claim_request",
      detail: c.trackingNumber,
      status: c.status,
      entityType: "claim_request",
      entityId: c.id,
      at: c.createdAt,
    })),
    ...msgs.map((m) => ({
      source: "message" as const,
      category: "message",
      action: "send_message",
      detail: m.message.slice(0, 140),
      entityType: "message",
      entityId: m.id,
      at: m.createdAt,
    })),
  ];

  feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return feed.slice(0, limit);
}

/** Global recent activity feed (all customers) joined with customer identity. */
export async function getActivityFeed(opts: {
  page: number;
  pageSize: number;
  customerId?: number;
  category?: string;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const conds = [];
  if (opts.customerId) conds.push(eq(customerActivityLog.customerId, opts.customerId));
  if (opts.category) conds.push(eq(customerActivityLog.category, opts.category as any));
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await safe(
    db.select({ total: sql<number>`count(*)` })
      .from(customerActivityLog)
      .where(where),
    [{ total: 0 }],
  );

  const data = await safe(
    db.select({
      id: customerActivityLog.id,
      customerId: customerActivityLog.customerId,
      action: customerActivityLog.action,
      category: customerActivityLog.category,
      path: customerActivityLog.path,
      detail: customerActivityLog.detail,
      entityType: customerActivityLog.entityType,
      entityId: customerActivityLog.entityId,
      ipAddress: customerActivityLog.ipAddress,
      createdAt: customerActivityLog.createdAt,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
      .from(customerActivityLog)
      .leftJoin(customers, eq(customerActivityLog.customerId, customers.id))
      .where(where)
      .orderBy(desc(customerActivityLog.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    [],
  );

  return { data, total: num(total) };
}

/** All customer self-declared tracking numbers, with owner identity. */
export async function listDeclaredPackagesWithCustomer(opts: {
  search?: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const conds = [];
  if (opts.status) conds.push(eq(customerDeclaredPackages.status, opts.status as any));
  if (opts.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    conds.push(or(like(customerDeclaredPackages.trackingNumber, s), like(customerDeclaredPackages.productName, s))!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(customerDeclaredPackages)
    .where(where);

  const data = await db
    .select({
      id: customerDeclaredPackages.id,
      customerId: customerDeclaredPackages.customerId,
      trackingNumber: customerDeclaredPackages.trackingNumber,
      platform: customerDeclaredPackages.platform,
      productName: customerDeclaredPackages.productName,
      status: customerDeclaredPackages.status,
      matchedPackageId: customerDeclaredPackages.matchedPackageId,
      createdAt: customerDeclaredPackages.createdAt,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
    .from(customerDeclaredPackages)
    .leftJoin(customers, eq(customerDeclaredPackages.customerId, customers.id))
    .where(where)
    .orderBy(desc(customerDeclaredPackages.createdAt))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);

  return { data, total: num(total) };
}

/** All customer claim requests, with claimant identity. */
export async function listClaimRequestsWithCustomer(opts: {
  search?: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const conds = [];
  if (opts.status) conds.push(eq(packageClaimRequests.status, opts.status as any));
  if (opts.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    conds.push(or(like(packageClaimRequests.trackingNumber, s), like(packageClaimRequests.requestNumber, s))!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(packageClaimRequests)
    .where(where);

  const data = await db
    .select({
      id: packageClaimRequests.id,
      requestNumber: packageClaimRequests.requestNumber,
      customerId: packageClaimRequests.customerId,
      trackingNumber: packageClaimRequests.trackingNumber,
      status: packageClaimRequests.status,
      customerNote: packageClaimRequests.customerNote,
      createdAt: packageClaimRequests.createdAt,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
    .from(packageClaimRequests)
    .leftJoin(customers, eq(packageClaimRequests.customerId, customers.id))
    .where(where)
    .orderBy(desc(packageClaimRequests.createdAt))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);

  return { data, total: num(total) };
}
