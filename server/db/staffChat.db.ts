import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { staffMessages } from "../../drizzle/schema/notifications.schema";
import { users } from "../../drizzle/schema/users.schema";
import { retryFix, withFix } from "@shared/fixAdvice";

/**
 * What one member of staff said to another.
 *
 * The owner, 2026-09-26: «گرنگە پەیام ناردن هەبێ لە نێوان ئادمینەکان، چات
 * کردن هەبێ وەکو مەسنجەر.»
 *
 * Between two people, always. Every read here is bounded by the pair, so a
 * conversation cannot be fetched by somebody who is not in it — the same
 * shape as the tasks table beside it, and for the same reason: a query that
 * forgot would publish the office's private words and no screen would look
 * wrong.
 */

/** The two directions of one conversation. */
const between = (a: number, b: number) =>
  or(
    and(eq(staffMessages.fromId, a), eq(staffMessages.toId, b)),
    and(eq(staffMessages.fromId, b), eq(staffMessages.toId, a)),
  );

export async function sendStaffMessage(
  fromId: number,
  toId: number,
  text: string,
): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) {
    throw new Error(retryFix("پەیامەکە نەنێردرا — پەیوەندی بە داتابەیسەوە نییە."));
  }
  const body = (text ?? "").trim();
  if (!body) {
    throw new Error(withFix("پەیامەکە بەتاڵە — هیچ نەنووسراوە.", [
      "شتێک بنووسە پاشان Enter بدە",
    ]));
  }
  if (fromId === toId) {
    throw new Error(withFix("ناکرێت پەیام بۆ خۆت بنێریت.", [
      "لە لیستی هاوکارەکان کەسێکی تر هەڵبژێرە",
      "ئەگەر بۆ خۆت بیرخەرەوەیەکت دەوێت، تاسکێک دروست بکە (Alt+T)",
    ]));
  }

  const inserted = await db.insert(staffMessages).values({
    fromId,
    toId,
    text: body.slice(0, 2000),
  });
  return { id: Number(inserted[0].insertId) };
}

/**
 * One conversation, oldest first — the order a chat is read in.
 *
 * The newest slice, then turned around: a conversation of two thousand
 * messages should cost the same as a conversation of ten.
 */
export async function staffConversation(userId: number, otherId: number, limit = 80) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: staffMessages.id,
      fromId: staffMessages.fromId,
      toId: staffMessages.toId,
      text: staffMessages.text,
      readAt: staffMessages.readAt,
      createdAt: staffMessages.createdAt,
    })
    .from(staffMessages)
    .where(between(userId, otherId))
    .orderBy(desc(staffMessages.id))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.reverse();
}

/**
 * Everybody this person can write to, with the last thing said and how much
 * of it they have not read.
 *
 * One query for the whole list rather than one per colleague: the panel opens
 * on it and polls it.
 */
export async function staffInbox(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const staff = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.name);
  const others = staff.filter((s) => Number(s.id) !== userId);
  if (others.length === 0) return [];

  const ids = others.map((s) => Number(s.id));

  // Everything either way, newest first; the first row seen for a colleague
  // is the last thing said to or by them.
  const recent = await db
    .select({
      id: staffMessages.id,
      fromId: staffMessages.fromId,
      toId: staffMessages.toId,
      text: staffMessages.text,
      readAt: staffMessages.readAt,
      createdAt: staffMessages.createdAt,
    })
    .from(staffMessages)
    .where(or(
      and(eq(staffMessages.fromId, userId), inArray(staffMessages.toId, ids)),
      and(eq(staffMessages.toId, userId), inArray(staffMessages.fromId, ids)),
    ))
    .orderBy(desc(staffMessages.id))
    .limit(500);

  const lastOf = new Map<number, (typeof recent)[number]>();
  const unread = new Map<number, number>();
  for (const m of recent) {
    const other = Number(m.fromId) === userId ? Number(m.toId) : Number(m.fromId);
    if (!lastOf.has(other)) lastOf.set(other, m);
    if (Number(m.toId) === userId && !m.readAt) unread.set(other, (unread.get(other) ?? 0) + 1);
  }

  return others
    .map((s) => {
      const last = lastOf.get(Number(s.id));
      return {
        id: Number(s.id),
        name: s.name ?? "",
        role: s.role ?? "",
        lastText: last?.text ?? null,
        lastAt: last?.createdAt ?? null,
        lastFromMe: last ? Number(last.fromId) === userId : false,
        unread: unread.get(Number(s.id)) ?? 0,
      };
    })
    // Somebody waiting for an answer comes first, then whoever spoke last,
    // then the rest of the office in name order.
    .sort((a, b) => {
      if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) return (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0);
      const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name);
    });
}

/** How many messages are waiting for this person, for the bubble's badge. */
export async function staffUnreadCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(staffMessages)
    .where(and(eq(staffMessages.toId, userId), isNull(staffMessages.readAt)));
  return Number(row?.n ?? 0);
}

/** Opening a conversation marks what was said in it as read. */
export async function markStaffMessagesRead(userId: number, otherId: number): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) return { ok: false };
  await db
    .update(staffMessages)
    .set({ readAt: new Date() })
    .where(and(
      eq(staffMessages.toId, userId),
      eq(staffMessages.fromId, otherId),
      isNull(staffMessages.readAt),
    ));
  return { ok: true };
}
