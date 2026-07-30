import { eq, and, asc, desc, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { portalTutorials, type PortalTutorial, type InsertPortalTutorial } from "../../drizzle/schema";

/**
 * Portal tutorials — short YouTube walkthroughs grouped into admin-defined
 * sections ("Taobao", "Pinduoduo", "Portal", …).
 *
 * Only the link is stored. The video stays on YouTube, so an embedded play
 * still counts toward the channel's own view count and there is no hosting to
 * maintain.
 */

/**
 * Pull the video id out of any of the shapes YouTube hands out — the long
 * watch URL, a youtu.be short link, an /embed/ or /shorts/ path. Returning
 * null rather than guessing means a mistyped link shows as "no thumbnail"
 * instead of a broken image.
 */
export function youTubeVideoId(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{6,})/,        // watch?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,   // youtu.be/ID
    /\/embed\/([A-Za-z0-9_-]{6,})/,     // /embed/ID
    /\/shorts\/([A-Za-z0-9_-]{6,})/,    // /shorts/ID
    /\/live\/([A-Za-z0-9_-]{6,})/,      // /live/ID
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Everything the portal needs to render a card, without a second request. */
function decorate(row: PortalTutorial) {
  const videoId = youTubeVideoId(row.videoUrl);
  return {
    ...row,
    videoId,
    // YouTube serves this for every public video, so a section never needs an
    // uploaded cover image.
    thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
  };
}

export type TutorialForPortal = ReturnType<typeof decorate>;

/** Published tutorials for the customer portal, featured first. */
export async function getPublishedTutorials(category?: string): Promise<TutorialForPortal[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(portalTutorials.isPublished, true)];
  if (category) conditions.push(eq(portalTutorials.category, category));
  const rows = await db.select().from(portalTutorials)
    .where(and(...conditions))
    .orderBy(desc(portalTutorials.isFeatured), asc(portalTutorials.sortOrder), desc(portalTutorials.id));
  return rows.map(decorate);
}

/** Every tutorial, including drafts — the Portal Center list. */
export async function getAllTutorials(): Promise<TutorialForPortal[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(portalTutorials)
    .orderBy(asc(portalTutorials.category), asc(portalTutorials.sortOrder), desc(portalTutorials.id));
  return rows.map(decorate);
}

/** Distinct section names that already have at least one tutorial. */
export async function getTutorialCategories(publishedOnly = true): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.selectDistinct({ category: portalTutorials.category })
    .from(portalTutorials)
    .where(publishedOnly ? eq(portalTutorials.isPublished, true) : undefined);
  return rows.map(r => r.category).filter(Boolean).sort();
}

export async function createTutorial(data: InsertPortalTutorial): Promise<PortalTutorial | null> {
  const db = await getDb();
  if (!db) return null;
  const [res] = await db.insert(portalTutorials).values(data);
  const [row] = await db.select().from(portalTutorials).where(eq(portalTutorials.id, (res as any).insertId));
  return row ?? null;
}

export async function updateTutorial(id: number, data: Partial<InsertPortalTutorial>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(portalTutorials).set(data).where(eq(portalTutorials.id, id));
  return true;
}

export async function deleteTutorial(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(portalTutorials).where(eq(portalTutorials.id, id));
  return true;
}

/**
 * Counters. Incremented in SQL rather than read-modify-write so two customers
 * watching at once can't overwrite each other's count.
 */
export async function recordTutorialEvent(
  id: number,
  event: "view" | "completed" | "helpful" | "notHelpful",
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const column = {
    view: "viewCount",
    completed: "completedCount",
    helpful: "helpfulCount",
    notHelpful: "notHelpfulCount",
  }[event];
  await db.execute(
    sql.raw(`UPDATE portalTutorials SET ${column} = ${column} + 1 WHERE id = ${Number(id)}`),
  );
}
