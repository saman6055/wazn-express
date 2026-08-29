import { randomBytes } from "crypto";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { packageShareLinks, packages, batches } from "../../drizzle/schema";
import type { PackageShareLink } from "../../drizzle/schema/packages.schema";
import { appLogger } from "../utils/logger";
import { toShareableParcel, shareLinkUsable, SHARE_LINK_DAYS, type ShareableParcel } from "@shared/shareLink";

/**
 * Links a customer sends to whoever is receiving their parcel.
 *
 * The recipient has no account and should not need one. The token is the
 * whole of the security here, so everything about how it is made and checked
 * matters more than it usually would.
 */

/**
 * A token nobody can guess.
 *
 * Thirty-two random bytes, base64url. Deliberately not derived from the
 * tracking number: a courier already knows that one, and so does anybody who
 * has seen the parcel.
 */
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Make a link for a parcel, or hand back the one that already works.
 *
 * Reusing the live link matters: a customer who presses share twice should
 * send the same address, not leave a trail of separate links they would have
 * to revoke one at a time.
 */
export async function createShareLink(
  packageId: number,
  customerId: number,
): Promise<{ token: string; expiresAt: Date } | null> {
  const db = await getDb();
  if (!db) return null;

  // Their own parcel, or nothing. The whole feature is one query away from
  // handing somebody a link to a stranger's goods.
  const [pkg] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(and(eq(packages.id, packageId), eq(packages.customerId, customerId)))
    .limit(1);
  if (!pkg) return null;

  const [existing] = await db
    .select()
    .from(packageShareLinks)
    .where(and(
      eq(packageShareLinks.packageId, packageId),
      eq(packageShareLinks.customerId, customerId),
      isNull(packageShareLinks.revokedAt),
    ))
    .orderBy(desc(packageShareLinks.id))
    .limit(1);
  if (existing && shareLinkUsable(existing)) {
    return { token: existing.token, expiresAt: existing.expiresAt };
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + SHARE_LINK_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(packageShareLinks).values({ token, packageId, customerId, expiresAt });
  return { token, expiresAt };
}

/** Turn a link off. Only the customer who made it may. */
export async function revokeShareLink(token: string, customerId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db
    .update(packageShareLinks)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(packageShareLinks.token, token),
      eq(packageShareLinks.customerId, customerId),
      isNull(packageShareLinks.revokedAt),
    ));
  return true;
}

/** Every live link this customer has handed out. */
export async function listShareLinks(customerId: number): Promise<PackageShareLink[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(packageShareLinks)
    .where(and(eq(packageShareLinks.customerId, customerId), isNull(packageShareLinks.revokedAt)))
    .orderBy(desc(packageShareLinks.id));
  return rows.filter((r) => shareLinkUsable(r));
}

/**
 * What the holder of a link may see.
 *
 * Returns null for anything wrong — expired, revoked, unknown token — with no
 * hint as to which. A public endpoint that distinguishes "no such link" from
 * "that link expired" is one that confirms which tokens exist.
 */
export async function resolveShareLink(token: string): Promise<ShareableParcel | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [link] = await db
      .select()
      .from(packageShareLinks)
      .where(eq(packageShareLinks.token, token))
      .limit(1);
    if (!shareLinkUsable(link)) return null;

    const [row] = await db
      .select({
        trackingNumber: packages.trackingNumber,
        packageCode: packages.packageCode,
        description: packages.description,
        status: packages.status,
        weightKg: packages.weightKg,
        createdAt: packages.createdAt,
        deliveredAt: packages.deliveredAt,
        // The parcel's own pictures, of which the first is enough for a
        // page whose job is "here is your thing, it is on its way".
        photos: packages.photos,
        batchStatus: batches.status,
        estimatedArrival: batches.estimatedArrival,
      })
      .from(packages)
      .leftJoin(batches, eq(batches.id, packages.batchId))
      .where(eq(packages.id, link!.packageId))
      .limit(1);
    if (!row) return null;

    // Counted, not audited: a customer should be able to see that a link has
    // travelled further than they meant, without anyone recording who read it.
    await db
      .update(packageShareLinks)
      .set({ viewCount: sql`${packageShareLinks.viewCount} + 1`, lastViewedAt: new Date() })
      .where(eq(packageShareLinks.id, link!.id));

    return toShareableParcel({
      ...row,
      photoUrl: Array.isArray(row.photos) && row.photos.length > 0 ? row.photos[0]! : null,
    });
  } catch (err) {
    appLogger.error("[ShareLink] lookup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
