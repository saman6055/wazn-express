import { eq, asc } from "drizzle-orm";
import { getDb } from "./connection";
import { productAttributes, type ProductAttribute, type InsertProductAttribute } from "../../drizzle/schema";

export type ProductAttributeType = "color" | "size" | "productType" | "platform";

/**
 * Shops the orders are placed on. Seeded on first read so the dropdown is
 * never empty on a fresh install; admins add their own from the order form
 * afterwards. Order matches how often each is used day to day.
 */
const DEFAULT_PLATFORMS = ["Taobao", "Pinduoduo", "Alibaba", "Aliexpress", "Wechat", "1688"];

let _platformsSeeded = false;

/**
 * Insert the default platforms once, and only when none exist yet — so a
 * platform the admin deleted on purpose is not resurrected on next boot.
 */
async function seedPlatformsIfEmpty(): Promise<void> {
  if (_platformsSeeded) return;
  _platformsSeeded = true;
  const db = await getDb();
  if (!db) return;
  try {
    const existing = await db.select({ id: productAttributes.id })
      .from(productAttributes)
      .where(eq(productAttributes.type, "platform"))
      .limit(1);
    if (existing.length > 0) return;
    await db.insert(productAttributes).values(
      DEFAULT_PLATFORMS.map((value, i) => ({
        type: "platform" as const,
        value,
        sortOrder: i,
        isActive: true,
      })),
    );
  } catch {
    // Column may not have been widened yet on a stale deploy — the dropdown
    // just stays empty rather than breaking the order form.
    _platformsSeeded = false;
  }
}

export async function getProductAttributesByType(type: ProductAttributeType): Promise<ProductAttribute[]> {
  const db = await getDb();
  if (!db) return [];
  if (type === "platform") await seedPlatformsIfEmpty();
  return db.select()
    .from(productAttributes)
    .where(eq(productAttributes.type, type))
    .orderBy(asc(productAttributes.sortOrder), asc(productAttributes.id));
}

export async function getAllProductAttributes(): Promise<ProductAttribute[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(productAttributes)
    .orderBy(asc(productAttributes.type), asc(productAttributes.sortOrder), asc(productAttributes.id));
}

export async function createProductAttribute(data: InsertProductAttribute): Promise<ProductAttribute | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(productAttributes).values(data);
  const id = (result as any).insertId;
  const [row] = await db.select().from(productAttributes).where(eq(productAttributes.id, id));
  return row ?? null;
}

export async function updateProductAttribute(id: number, data: Partial<InsertProductAttribute>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(productAttributes).set(data).where(eq(productAttributes.id, id));
  return true;
}

export async function deleteProductAttribute(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(productAttributes).where(eq(productAttributes.id, id));
  return true;
}
