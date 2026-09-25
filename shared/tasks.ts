/**
 * A promise somebody made to themselves, and the system holding them to it.
 *
 * The owner, 2026-09-25: "a piece went to Layla by mistake — it isn't hers. I
 * killed the charge, but the piece is still with her, so until I forget I
 * need a reminder, until the task is done. But how?"
 *
 * That is a different animal from everything the bell already carries. A risk
 * is something the system noticed and it clears itself when the data changes:
 * a parcel stops being stale the day it moves. Nothing the database can be
 * asked will ever say whether Layla handed the piece back. Only a person
 * knows, so only a person can close it.
 *
 * So a task is stored, not derived — the opposite of the parcel stage beside
 * it, and for the opposite reason.
 *
 * Two rules keep it from becoming the list nobody reads:
 *
 *  1. It is fastened to the thing it is about, so the words can be short and
 *     one click goes to the box, the parcel, the customer it names.
 *  2. It is seen by exactly two people — whoever wrote it and whoever it is
 *     for. There is no company-wide list of everybody's promises.
 */

/** What a task can be fastened to. "none" is a task about nothing in particular. */
export const TASK_ABOUT_TYPES = [
  "none",
  "parcel",
  "box",
  "customer",
  "batch",
  "order",
  "invoice",
] as const;

export type TaskAboutType = (typeof TASK_ABOUT_TYPES)[number];

export interface TaskAbout {
  type: TaskAboutType;
  /** The row it points at, when there is one. */
  id?: number | null;
  /** What to print: a tracking, a box code, a customer's name. */
  label?: string | null;
  /** Where clicking it goes. */
  href?: string | null;
}

export interface Task {
  id: number;
  text: string;
  about: TaskAbout;
  createdById: number;
  createdByName?: string | null;
  assignedToId: number;
  assignedToName?: string | null;
  dueAt: Date | string | null;
  /** Quiet until this moment, then back in the list. */
  snoozedUntil: Date | string | null;
  doneAt: Date | string | null;
  doneById: number | null;
  createdAt: Date | string;
}

/**
 * Who may see a task: the person who wrote it and the person it is for.
 *
 * The owner, 2026-09-25: "each admin should see their own tasks — only the
 * ones I assign to another admin should also show for them, or one an admin
 * sends me. My personal task shows only to me."
 *
 * Written here, and asserted in the query, so no screen can widen it by
 * accident.
 */
export function canSeeTask(task: Pick<Task, "createdById" | "assignedToId">, userId: number): boolean {
  return task.createdById === userId || task.assignedToId === userId;
}

/** Is it still asking to be done? */
export function isOpen(task: Pick<Task, "doneAt">): boolean {
  return !task.doneAt;
}

/** Put down for now, and not yet picked up again. */
export function isSnoozed(task: Pick<Task, "snoozedUntil">, now: Date = new Date()): boolean {
  if (!task.snoozedUntil) return false;
  return new Date(task.snoozedUntil).getTime() > now.getTime();
}

/** What the bell counts: open, and not sleeping. */
export function isAwake(task: Pick<Task, "doneAt" | "snoozedUntil">, now: Date = new Date()): boolean {
  return isOpen(task) && !isSnoozed(task, now);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since it was written. */
export function ageInDays(task: Pick<Task, "createdAt">, now: Date = new Date()): number {
  const at = new Date(task.createdAt).getTime();
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.floor((now.getTime() - at) / DAY_MS));
}

export type TaskTone = "fresh" | "waiting" | "late";

/**
 * How loudly it is asking.
 *
 * It reddens with age rather than shouting from the first hour: a task
 * written this morning is not a failure, and colouring it like one teaches
 * people to ignore the colour. A week is where it becomes one.
 */
export const TASK_LATE_AFTER_DAYS = 7;
export const TASK_WAITING_AFTER_DAYS = 2;

export function taskTone(task: Pick<Task, "createdAt">, now: Date = new Date()): TaskTone {
  const days = ageInDays(task, now);
  if (days >= TASK_LATE_AFTER_DAYS) return "late";
  if (days >= TASK_WAITING_AFTER_DAYS) return "waiting";
  return "fresh";
}

/** Oldest first: the one that has been waiting longest is the one to do. */
export function byOldestFirst(a: Pick<Task, "createdAt">, b: Pick<Task, "createdAt">): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/** Tomorrow morning — what "remind me tomorrow" means. */
export function tomorrowMorning(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(8, 0, 0, 0);
  return next;
}

export const TASK_WORDS = {
  title: { ku: "تاسکێکی نوێ", en: "New task", ar: "مهمة جديدة", zh: "新任务" },
  mine: { ku: "تاسکەکانم", en: "My tasks", ar: "مهامي", zh: "我的任务" },
  placeholder: {
    ku: "چی دەبێت بکرێت؟",
    en: "What needs doing?",
    ar: "ما الذي يجب عمله؟",
    zh: "需要做什么？",
  },
  add: { ku: "زیادی بکە", en: "Add", ar: "أضف", zh: "添加" },
  added: { ku: "تاسک زیاد کرا", en: "Task added", ar: "أُضيفت المهمة", zh: "任务已添加" },
  /** Take the record off, when the task is not about it after all. */
  unfasten: { ku: "لای ببە", en: "Remove", ar: "إزالة", zh: "移除" },
  forWhom: { ku: "بۆ کێ", en: "For", ar: "لمن", zh: "指派给" },
  me: { ku: "خۆم", en: "Me", ar: "لي", zh: "我自己" },
  about: { ku: "سەبارەت بە", en: "About", ar: "بخصوص", zh: "关于" },
  done: { ku: "تەواو بوو", en: "Done", ar: "تم", zh: "已完成" },
  snooze: { ku: "سبەی بیرم بخەرەوە", en: "Remind me tomorrow", ar: "ذكّرني غداً", zh: "明天提醒我" },
  empty: {
    ku: "هیچ تاسکێکی کراوە نییە",
    en: "Nothing waiting",
    ar: "لا شيء بالانتظار",
    zh: "没有待办事项",
  },
  makeTask: { ku: "بیکە تاسک", en: "Make a task", ar: "اجعلها مهمة", zh: "创建任务" },
  openDays: (n: number) => ({
    ku: `${n} ڕۆژە کراوەیە`,
    en: `Open ${n} days`,
    ar: `مفتوحة منذ ${n} يوم`,
    zh: `已开启 ${n} 天`,
  }),
} as const;
