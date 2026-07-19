import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "./connection";
import { customerDeclaredPackages, customers } from "../../drizzle/schema";
import type {
  CustomerDeclaredPackage,
  InsertCustomerDeclaredPackage,
} from "../../drizzle/schema/packages.schema";

/**
 * Customer "pre-alert" declarations — a customer tells us a tracking number is
 * coming BEFORE it arrives, optionally with platform / photo / category /
 * notes / purchase date. Staff registering that tracking in Quick Register get
 * the owner auto-matched instead of the package landing "unclaimed".
 */

const norm = (t: string) => t.trim();

export async function createDeclaredPackage(
  data: InsertCustomerDeclaredPackage,
): Promise<CustomerDeclaredPackage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values = { ...data, trackingNumber: norm(data.trackingNumber) };
  const result = await db.insert(customerDeclaredPackages).values(values);
  const [row] = await db
    .select()
    .from(customerDeclaredPackages)
    .where(eq(customerDeclaredPackages.id, Number(result[0].insertId)));
  return row;
}

/** A customer's own declarations, newest first (excludes cancelled). */
export async function getDeclaredPackagesByCustomer(
  customerId: number,
): Promise<CustomerDeclaredPackage[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customerDeclaredPackages)
    .where(
      and(
        eq(customerDeclaredPackages.customerId, customerId),
        ne(customerDeclaredPackages.status, "cancelled"),
      ),
    )
    .orderBy(desc(customerDeclaredPackages.createdAt));
}

/** Guarded update — only the owning customer may edit their own declaration. */
export async function updateDeclaredPackageForCustomer(
  id: number,
  customerId: number,
  data: Partial<InsertCustomerDeclaredPackage>,
): Promise<CustomerDeclaredPackage | null> {
  const db = await getDb();
  if (!db) return null;
  const patch = { ...data };
  if (patch.trackingNumber) patch.trackingNumber = norm(patch.trackingNumber);
  await db
    .update(customerDeclaredPackages)
    .set(patch)
    .where(
      and(
        eq(customerDeclaredPackages.id, id),
        eq(customerDeclaredPackages.customerId, customerId),
      ),
    );
  const [row] = await db
    .select()
    .from(customerDeclaredPackages)
    .where(eq(customerDeclaredPackages.id, id));
  return row ?? null;
}

/** Soft-cancel (owning customer only). */
export async function cancelDeclaredPackageForCustomer(
  id: number,
  customerId: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customerDeclaredPackages)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(customerDeclaredPackages.id, id),
        eq(customerDeclaredPackages.customerId, customerId),
      ),
    );
}

/**
 * The active (not-yet-cancelled) declaration for a tracking number, with the
 * declaring customer attached. Used at registration time to auto-own an
 * otherwise-unclaimed package. Newest wins if several exist. Comparison is
 * case-insensitive via the column collation; we trim to match how the value
 * was stored.
 */
export async function findActiveDeclaredByTracking(
  trackingNumber: string,
): Promise<
  | {
      declared: CustomerDeclaredPackage;
      customer: typeof customers.$inferSelect | null;
    }
  | null
> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ declared: customerDeclaredPackages, customer: customers })
    .from(customerDeclaredPackages)
    .leftJoin(customers, eq(customerDeclaredPackages.customerId, customers.id))
    .where(
      and(
        eq(customerDeclaredPackages.trackingNumber, norm(trackingNumber)),
        ne(customerDeclaredPackages.status, "cancelled"),
      ),
    )
    .orderBy(desc(customerDeclaredPackages.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Mark a declaration fulfilled once its physical package is registered.
 * Best-effort: never throws into the registration flow.
 */
export async function markDeclaredMatched(
  trackingNumber: string,
  packageId?: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customerDeclaredPackages)
    .set({ status: "matched", matchedPackageId: packageId, matchedAt: new Date() })
    .where(
      and(
        eq(customerDeclaredPackages.trackingNumber, norm(trackingNumber)),
        eq(customerDeclaredPackages.status, "pending"),
      ),
    );
}
