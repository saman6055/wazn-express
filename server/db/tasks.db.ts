import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { tasks } from "../../drizzle/schema/notifications.schema";
import { users } from "../../drizzle/schema/users.schema";
import type { TaskAboutType } from "@shared/tasks";
import { retryFix, withFix } from "@shared/fixAdvice";

/**
 * Tasks: written down, and only ever closed by a person.
 *
 * The visibility rule lives in the WHERE clause of every read here, not in
 * the screens — the owner's rule, 2026-09-25: a task is seen by whoever wrote
 * it and whoever it is for, and by nobody else. A query that forgot it would
 * publish one admin's private list to the whole office, and no screen would
 * look wrong.
 */

/** Whoever wrote it, or whoever it is for. Nobody else, ever. */
const visibleTo = (userId: number) =>
  or(eq(tasks.createdById, userId), eq(tasks.assignedToId, userId));

export interface NewTask {
  text: string;
  assignedToId?: number | null;
  aboutType?: TaskAboutType;
  aboutId?: number | null;
  aboutLabel?: string | null;
  aboutHref?: string | null;
  dueAt?: Date | null;
}

export async function createTask(input: NewTask, userId: number): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error(retryFix("ناکرێت تاسک تۆمار بکرێت — پەیوەندی بە داتابەیسەوە نییە."));

  const text = (input.text ?? "").trim();
  if (!text) {
    throw new Error(withFix("تاسکەکە بەتاڵە — هیچ نەنووسراوە.", [
      "بنووسە چی دەبێت بکرێت، نمونە: «پارچەکە لە لەیلا وەربگرەوە»",
      "پاشان Enter بدە یان دوگمەی «زیادی بکە» دابگرە",
    ]));
  }

  const inserted = await db.insert(tasks).values({
    text: text.slice(0, 1000),
    assignedToId: input.assignedToId ?? userId,
    createdById: userId,
    aboutType: input.aboutType ?? "none",
    aboutId: input.aboutId ?? null,
    aboutLabel: input.aboutLabel?.slice(0, 255) ?? null,
    aboutHref: input.aboutHref?.slice(0, 500) ?? null,
    dueAt: input.dueAt ?? null,
  });
  return { id: Number(inserted[0].insertId) };
}

const creator = { id: users.id, name: users.name };

/**
 * What is on this person's list, and what they sent somebody.
 *
 * Open ones first, oldest first — the one that has waited longest is the one
 * to do. A short tail of recently finished ones comes with them, because the
 * commonest question after closing a task is "did I close the right one".
 */
export async function tasksFor(userId: number, now: Date = new Date()) {
  const db = await getDb();
  if (!db) return { open: [], done: [] };

  const rows = await db
    .select({
      id: tasks.id,
      text: tasks.text,
      aboutType: tasks.aboutType,
      aboutId: tasks.aboutId,
      aboutLabel: tasks.aboutLabel,
      aboutHref: tasks.aboutHref,
      createdById: tasks.createdById,
      assignedToId: tasks.assignedToId,
      dueAt: tasks.dueAt,
      snoozedUntil: tasks.snoozedUntil,
      doneAt: tasks.doneAt,
      doneById: tasks.doneById,
      createdAt: tasks.createdAt,
      createdByName: creator.name,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.createdById))
    .where(visibleTo(userId))
    .orderBy(desc(tasks.createdAt))
    .limit(200);

  const shape = (r: (typeof rows)[number]) => ({
    id: r.id,
    text: r.text,
    about: {
      type: (r.aboutType ?? "none") as TaskAboutType,
      id: r.aboutId,
      label: r.aboutLabel,
      href: r.aboutHref,
    },
    createdById: r.createdById,
    createdByName: r.createdByName,
    assignedToId: r.assignedToId,
    dueAt: r.dueAt,
    snoozedUntil: r.snoozedUntil,
    doneAt: r.doneAt,
    doneById: r.doneById,
    createdAt: r.createdAt,
  });

  const open = rows
    .filter((r) => !r.doneAt)
    .map(shape)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  // The last few closed, newest first — enough to check what was just ticked.
  const done = rows.filter((r) => r.doneAt).slice(0, 20).map(shape);

  void now;
  return { open, done };
}

/**
 * Tick it, or put it back.
 *
 * Both go through the same visibility clause: a task nobody may see is a task
 * nobody may close.
 */
export async function setTaskDone(id: number, done: boolean, userId: number): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) return { ok: false };
  await db
    .update(tasks)
    .set(done ? { doneAt: new Date(), doneById: userId } : { doneAt: null, doneById: null })
    .where(and(eq(tasks.id, id), visibleTo(userId)));
  return { ok: true };
}

/** Quiet until a moment, then back in the list. */
export async function snoozeTask(id: number, until: Date, userId: number): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) return { ok: false };
  await db
    .update(tasks)
    .set({ snoozedUntil: until })
    .where(and(eq(tasks.id, id), visibleTo(userId), isNull(tasks.doneAt)));
  return { ok: true };
}

/**
 * How many are waiting on this person right now.
 *
 * Counted in SQL rather than by fetching the list: the icon asks this often
 * and needs a number, not two hundred rows.
 */
export async function awakeTaskCount(userId: number, now: Date = new Date()): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(tasks)
    .where(and(
      eq(tasks.assignedToId, userId),
      isNull(tasks.doneAt),
      or(isNull(tasks.snoozedUntil), sql`${tasks.snoozedUntil} <= ${now}`),
    ));
  return Number(row?.n ?? 0);
}

/** The colleagues a task can be handed to. */
export async function assignableStaff() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.name);
}
