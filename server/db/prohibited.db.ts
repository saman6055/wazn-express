import { getDb } from './connection';
import { eq, and, desc, sql, like, or, count } from "drizzle-orm";
import {
  prohibitedPackages, InsertProhibitedPackage, ProhibitedPackage,
  customers,
} from "../../drizzle/schema";

// ---------------------------------------------------------------------------
// Prohibited packages
// ---------------------------------------------------------------------------

export async function createProhibitedPackage(data: InsertProhibitedPackage): Promise<ProhibitedPackage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(prohibitedPackages).values(data);
  const insertId = Number(result[0].insertId);
  const [row] = await db.select().from(prohibitedPackages).where(eq(prohibitedPackages.id, insertId));
  return row;
}

/** A customer's prohibited packages (newest first, excludes cancelled). */
export async function getProhibitedPackagesByCustomer(customerId: number): Promise<ProhibitedPackage[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(prohibitedPackages)
    .where(and(eq(prohibitedPackages.customerId, customerId), sql`${prohibitedPackages.status} <> 'cancelled'`))
    .orderBy(desc(prohibitedPackages.createdAt));
}

export async function getProhibitedPackageById(id: number): Promise<ProhibitedPackage | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(prohibitedPackages).where(eq(prohibitedPackages.id, id));
  return row || null;
}

/** Mark as seen by its owner (first view only). Returns the row or null. */
export async function markProhibitedViewed(id: number, customerId: number): Promise<ProhibitedPackage | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await getProhibitedPackageById(id);
  if (!row || row.customerId !== customerId) return null;
  if (!row.viewedByCustomerAt) {
    await db.update(prohibitedPackages).set({ viewedByCustomerAt: new Date() }).where(eq(prohibitedPackages.id, id));
  }
  return getProhibitedPackageById(id);
}

/** Owner-guarded: the customer picks a resolution. */
export async function chooseProhibitedResolution(
  id: number,
  customerId: number,
  choice: ProhibitedPackage["resolutionChoice"],
  reshipAddress: string | null,
): Promise<ProhibitedPackage | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await getProhibitedPackageById(id);
  if (!row || row.customerId !== customerId) return null;
  await db.update(prohibitedPackages)
    .set({
      resolutionChoice: choice,
      reshipAddress: choice === "reship" ? reshipAddress : null,
      resolutionChosenAt: new Date(),
      viewedByCustomerAt: row.viewedByCustomerAt ?? new Date(),
      status: "chosen",
    })
    .where(eq(prohibitedPackages.id, id));
  return getProhibitedPackageById(id);
}

export async function updateProhibitedStatus(id: number, status: ProhibitedPackage["status"]): Promise<ProhibitedPackage | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(prohibitedPackages).set({ status }).where(eq(prohibitedPackages.id, id));
  return getProhibitedPackageById(id);
}

/** Record the fee that was posted to the customer's account as a debt. */
export async function setProhibitedFee(id: number, feeUsd: string, ledgerTransactionId: number | null): Promise<ProhibitedPackage | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(prohibitedPackages)
    .set({ feeUsd, ledgerTransactionId, chargedAt: new Date() })
    .where(eq(prohibitedPackages.id, id));
  return getProhibitedPackageById(id);
}

/** Admin listing with customer name/code, paginated + searchable. */
export async function listProhibitedWithCustomer(input: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: any[]; total: number; page: number; pageSize: number }> {
  const db = await getDb();
  if (!db) return { data: [], total: 0, page: 1, pageSize: 20 };
  const page = input.page && input.page > 0 ? input.page : 1;
  const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : 20;

  const conds: any[] = [];
  if (input.status && input.status !== "all") conds.push(eq(prohibitedPackages.status, input.status as any));
  if (input.search?.trim()) {
    const q = `%${input.search.trim()}%`;
    conds.push(or(
      like(prohibitedPackages.trackingNumber, q),
      like(customers.fullName, q),
      like(customers.customerCode, q),
    ));
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db.select({
    id: prohibitedPackages.id,
    customerId: prohibitedPackages.customerId,
    customerName: customers.fullName,
    customerCode: customers.customerCode,
    trackingNumber: prohibitedPackages.trackingNumber,
    photos: prohibitedPackages.photos,
    reasonId: prohibitedPackages.reasonId,
    reasonNote: prohibitedPackages.reasonNote,
    resolutionChoice: prohibitedPackages.resolutionChoice,
    reshipAddress: prohibitedPackages.reshipAddress,
    resolutionChosenAt: prohibitedPackages.resolutionChosenAt,
    viewedByCustomerAt: prohibitedPackages.viewedByCustomerAt,
    feeUsd: prohibitedPackages.feeUsd,
    chargedAt: prohibitedPackages.chargedAt,
    status: prohibitedPackages.status,
    createdAt: prohibitedPackages.createdAt,
  })
    .from(prohibitedPackages)
    .leftJoin(customers, eq(prohibitedPackages.customerId, customers.id))
    .where(where)
    .orderBy(desc(prohibitedPackages.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ c } = { c: 0 }] = await db.select({ c: count() })
    .from(prohibitedPackages)
    .leftJoin(customers, eq(prohibitedPackages.customerId, customers.id))
    .where(where);

  return { data: rows, total: Number(c) || 0, page, pageSize };
}
