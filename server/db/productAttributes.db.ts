import { eq, asc } from "drizzle-orm";
import { getDb } from "./connection";
import { productAttributes, type ProductAttribute, type InsertProductAttribute } from "../../drizzle/schema";

export async function getProductAttributesByType(type: "color" | "size" | "productType"): Promise<ProductAttribute[]> {
  const db = await getDb();
  if (!db) return [];
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
