import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "./connection";
import { customerDeclaredPackages, customers, packages } from "../../drizzle/schema";
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
    .orderBy(desc(customerDeclaredPackages.createdAt))
    // Capped: these carry base64 images and grow with the account.
    .limit(200);
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
  // The update above is owner-guarded; this read-back was not. Passing another
  // customer's id wrote nothing but returned their whole declaration —
  // tracking number, product, platform, notes, images — so walking the id
  // range enumerated every pre-alert in the system.
  const [row] = await db
    .select()
    .from(customerDeclaredPackages)
    .where(
      and(
        eq(customerDeclaredPackages.id, id),
        eq(customerDeclaredPackages.customerId, customerId),
      ),
    );
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
/**
 * Is someone else already expecting this tracking number?
 *
 * Two customers can honestly type the same number — a shared shop account, a
 * mistyped digit. The danger is what happens next: `findActiveDeclaredByTracking`
 * takes the NEWEST declaration, so whoever declared last would have been handed
 * the parcel at quick-register, automatically, with a green "declared by" card
 * telling staff it was correct.
 *
 * So a declaration that collides with another customer's is refused at the
 * door, and the office is told. Nothing is guessed and nothing is silently
 * reassigned.
 */
export async function findConflictingDeclaration(
  trackingNumber: string,
  customerId: number,
): Promise<CustomerDeclaredPackage | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(customerDeclaredPackages)
    .where(
      and(
        eq(customerDeclaredPackages.trackingNumber, norm(trackingNumber)),
        ne(customerDeclaredPackages.customerId, customerId),
        ne(customerDeclaredPackages.status, "cancelled"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

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

/** This customer's own active declaration for a tracking number (newest). */
export async function findCustomerDeclaredByTracking(
  customerId: number,
  trackingNumber: string,
): Promise<CustomerDeclaredPackage | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(customerDeclaredPackages)
    .where(
      and(
        eq(customerDeclaredPackages.customerId, customerId),
        eq(customerDeclaredPackages.trackingNumber, norm(trackingNumber)),
        ne(customerDeclaredPackages.status, "cancelled"),
      ),
    )
    .orderBy(desc(customerDeclaredPackages.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** One declaration, by its id. */
export async function getDeclaredPackageById(id: number): Promise<CustomerDeclaredPackage | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(customerDeclaredPackages).where(eq(customerDeclaredPackages.id, id)).limit(1);
  return row ?? null;
}

/**
 * Give a parcel that is nobody's to the customer who declared its tracking
 * (owner, 2026-09-18). The same fields approving an ownership claim writes
 * (approveClaimRequest in portal.db.ts) — and only while the parcel is still
 * nobody's, checked in the same statement, so two people linking at once
 * cannot give it twice. True when it was given.
 */
export async function linkUnownedPackageToCustomer(packageId: number, customerId: number, staffId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .update(packages)
    .set({
      customerId,
      isUnclaimed: false,
      claimedAt: new Date(),
      claimedById: staffId,
    })
    .where(and(eq(packages.id, packageId), isNull(packages.customerId)));
  return ((result[0] as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

/** This declaration, fulfilled by this parcel. */
export async function markDeclarationLinked(declarationId: number, packageId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customerDeclaredPackages)
    .set({ status: "matched", matchedPackageId: packageId, matchedAt: new Date() })
    .where(eq(customerDeclaredPackages.id, declarationId));
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
