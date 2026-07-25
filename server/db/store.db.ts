import { getDb } from './connection';
import { eq, ne, and, desc, asc, sql } from "drizzle-orm";
import {
  storeProducts, InsertStoreProduct, StoreProduct,
  storeOrders, InsertStoreOrder, StoreOrder,
} from "../../drizzle/schema";

// ---------------------------------------------------------------------------
// Wazn Store — products
// ---------------------------------------------------------------------------

/** Public listing: everything except hidden, best-sorted first. */
export async function getVisibleStoreProducts(): Promise<StoreProduct[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(storeProducts)
    .where(ne(storeProducts.status, "hidden"))
    .orderBy(desc(storeProducts.isFeatured), asc(storeProducts.sortOrder), desc(storeProducts.createdAt));
}

/** Featured, active products for a home/carousel strip. */
export async function getFeaturedStoreProducts(limit = 8): Promise<StoreProduct[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(storeProducts)
    .where(and(eq(storeProducts.status, "active"), eq(storeProducts.isFeatured, true)))
    .orderBy(asc(storeProducts.sortOrder), desc(storeProducts.createdAt))
    .limit(limit);
}

/** Admin listing: all products regardless of status. */
export async function getAllStoreProducts(): Promise<StoreProduct[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(storeProducts).orderBy(asc(storeProducts.sortOrder), desc(storeProducts.createdAt));
}

export async function getStoreProductById(id: number): Promise<StoreProduct | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(storeProducts).where(eq(storeProducts.id, id));
  return row || null;
}

export async function getStoreProductBySlug(slug: string): Promise<StoreProduct | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(storeProducts).where(eq(storeProducts.slug, slug));
  return row || null;
}

/** Slugify a product name into a URL-safe, unique-ish slug. Non-Latin names
 *  (Kurdish/Arabic) reduce to empty, so fall back to a "product" stem. */
function slugify(name: string): string {
  const base = (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "product"}-${Date.now().toString(36)}`;
}

export async function createStoreProduct(data: InsertStoreProduct): Promise<StoreProduct> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!data.slug) {
    data.slug = slugify(data.nameEn || data.nameKu || data.nameAr || "");
  }
  const result = await db.insert(storeProducts).values(data);
  const insertId = Number(result[0].insertId);
  const [row] = await db.select().from(storeProducts).where(eq(storeProducts.id, insertId));
  return row;
}

export async function updateStoreProduct(id: number, data: Partial<InsertStoreProduct>): Promise<StoreProduct | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(storeProducts).set(data).where(eq(storeProducts.id, id));
  return getStoreProductById(id);
}

export async function deleteStoreProduct(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.delete(storeProducts).where(eq(storeProducts.id, id));
  return (result[0] as any).affectedRows > 0;
}

export async function incrementStoreProductView(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(storeProducts)
    .set({ viewCount: sql`${storeProducts.viewCount} + 1` })
    .where(eq(storeProducts.id, id));
}

// ---------------------------------------------------------------------------
// Wazn Store — orders
// ---------------------------------------------------------------------------

export async function createStoreOrder(data: InsertStoreOrder): Promise<StoreOrder> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(storeOrders).values(data);
  const insertId = Number(result[0].insertId);
  // Bump the product's order counter (best-effort).
  if (data.productId) {
    await db.update(storeProducts)
      .set({ orderCount: sql`${storeProducts.orderCount} + 1` })
      .where(eq(storeProducts.id, data.productId));
  }
  const [row] = await db.select().from(storeOrders).where(eq(storeOrders.id, insertId));
  return row;
}

export async function getAllStoreOrders(): Promise<StoreOrder[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(storeOrders).orderBy(desc(storeOrders.createdAt));
}

export async function getStoreOrderById(id: number): Promise<StoreOrder | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(storeOrders).where(eq(storeOrders.id, id));
  return row || null;
}

export async function updateStoreOrderStatus(id: number, status: StoreOrder["status"]): Promise<StoreOrder | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(storeOrders).set({ status }).where(eq(storeOrders.id, id));
  return getStoreOrderById(id);
}
