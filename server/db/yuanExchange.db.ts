import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { customers, yuanExchangeOrders } from "../../drizzle/schema";
import type { InsertYuanExchangeOrder, YuanExchangeOrder } from "../../drizzle/schema/portalActivity.schema";

// ---------------------------------------------------------------------------
// Yuan exchange — customers buy CNY with USD at the company's sell rate.
// Reads degrade gracefully (empty results) when the table doesn't exist yet,
// same as the rest of the Portal Center data layer.
// ---------------------------------------------------------------------------

/** Swallow "table doesn't exist" (and any other read error) into a fallback. */
async function safe<T>(query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch {
    return fallback;
  }
}

export async function createYuanExchangeOrder(
  data: InsertYuanExchangeOrder,
): Promise<YuanExchangeOrder | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(yuanExchangeOrders).values(data);
  const [order] = await db
    .select()
    .from(yuanExchangeOrders)
    .where(eq(yuanExchangeOrders.id, result.insertId));
  return order ?? null;
}

export async function getYuanOrdersByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return safe(
    db
      .select()
      .from(yuanExchangeOrders)
      .where(eq(yuanExchangeOrders.customerId, customerId))
      .orderBy(desc(yuanExchangeOrders.createdAt))
      .limit(50),
    [],
  );
}

/** Admin list with the customer's name/code joined in. */
export async function listYuanExchangeOrders(options?: {
  status?: "pending" | "processing" | "completed" | "cancelled";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = options?.status ? [eq(yuanExchangeOrders.status, options.status)] : [];
  return safe(
    db
      .select({
        order: yuanExchangeOrders,
        customerName: customers.fullName,
        customerCode: customers.customerCode,
        customerMobile: customers.mobileNumber,
      })
      .from(yuanExchangeOrders)
      .leftJoin(customers, eq(yuanExchangeOrders.customerId, customers.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(yuanExchangeOrders.createdAt))
      .limit(options?.limit ?? 100),
    [],
  );
}

export async function updateYuanExchangeOrder(
  id: number,
  data: Partial<Pick<YuanExchangeOrder, "status" | "adminNote" | "handledById">>,
): Promise<YuanExchangeOrder | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(yuanExchangeOrders).set(data).where(eq(yuanExchangeOrders.id, id));
  const [order] = await db.select().from(yuanExchangeOrders).where(eq(yuanExchangeOrders.id, id));
  return order ?? null;
}

export async function countPendingYuanOrders(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await safe(
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(yuanExchangeOrders)
      .where(eq(yuanExchangeOrders.status, "pending")),
    [{ count: 0 }],
  );
  return Number(rows[0]?.count ?? 0);
}
