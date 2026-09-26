import { customersHref, packagesHref } from "./listLinks";
import { customerCodeOnly } from "./customerCode";

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

/**
 * Where a task taken off a screen leads back to.
 *
 * The owner, 2026-09-25: "the link of the place must go into the task — when
 * I press it, it goes straight to the section that task belongs to. This is
 * very important." A reminder that says «get the piece back» and then leaves
 * you to find the piece again has given back half of what it took.
 *
 * A code copied off any screen goes to the parcels table, searched — the
 * same link the command palette and the alert sheet already use, so there is
 * one answer to "take me to this code". A box code has no row there, so it
 * keeps the screen it was taken from, which is the box screen itself.
 */
export function hrefForValue(value: string, here: string): string {
  const code = (value ?? "").trim();
  if (!code) return here;

  /*
   * A box opens its own box.
   *
   * The owner, 2026-09-26: «گرنگە لینکی تاسک یەکسەر بچێتە سەر
   * خودی شتەکە — ئەو لینکە خۆش بوو یەکسەر بچووبایە ناو خودی
   * بۆکسەکە.» It used to keep the page the task was written on,
   * because a box has no row in the parcels table. The delivery screen
   * takes the code and opens it (pages/CustomerDeliveryScanner).
   */
  if (/^BOX-/i.test(code)) return `/customer-delivery-scanner?boxCode=${encodeURIComponent(code)}`;

  /*
   * A customer code opens that customer, not a search for their parcels.
   * AZ295, or AZ295(Osamah Anwar) as the office writes it.
   */
  if (/^[A-Za-z]{2,4}\d{2,6}(\(|$)/.test(code)) {
    return customersHref({ search: customerCodeOnly(code) });
  }

  return packagesHref({ search: code });
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
  sleeping: { ku: "خەوتوو", en: "Sleeping", ar: "نائمة", zh: "已延后" },
  wakeNow: { ku: "ئێستا بیهێنەوە", en: "Wake now", ar: "أيقظها الآن", zh: "立即唤醒" },
  guide: { ku: "تاسک چییە؟", en: "What is a task?", ar: "ما هي المهمة؟", zh: "什么是任务？" },
  close: { ku: "داخستن", en: "Close", ar: "إغلاق", zh: "关闭" },
  /** Where a new task comes from, said once on an empty list. */
  hint: {
    ku: "⁦Alt+T⁩ بۆ تاسکێکی نوێ، یان کلیکی لای ڕاست لەسەر هەر تراکێک",
    en: "Alt+T for a new task, or right-click any tracking",
    ar: "⁦Alt+T⁩ لمهمة جديدة، أو انقر بالزر الأيمن على أي تتبع",
    zh: "Alt+T 新建任务，或右键点击任意运单号",
  },
  archive: { ku: "ئەرشیف", en: "Archive", ar: "الأرشيف", zh: "存档" },
  archiveEmpty: {
    ku: "هیچ تاسکێکی تەواوبوو نییە",
    en: "Nothing finished yet",
    ar: "لا شيء منجز بعد",
    zh: "尚无已完成任务",
  },
  reopen: { ku: "بیهێنەوە", en: "Reopen", ar: "أعد فتحها", zh: "重新打开" },
  reopened: {
    ku: "تاسکەکە گەڕایەوە ناو لیست",
    en: "Back on the list",
    ar: "عادت إلى القائمة",
    zh: "已回到列表",
  },
  deleteTitle: {
    ku: "سڕینەوەی یەکجاریی",
    en: "Delete for good",
    ar: "حذف نهائي",
    zh: "永久删除",
  },
  deleteConfirm: { ku: "بیسڕەوە", en: "Delete", ar: "احذف", zh: "删除" },
  deleted: { ku: "سڕایەوە", en: "Deleted", ar: "حُذفت", zh: "已删除" },
  /** Taught in the empty window, because nobody guesses a right-click. */
  fastenHint: {
    ku: "کلیکی لای ڕاست لەسەر هەر تراک یان کۆدێک، تاسکەکە بەو تۆمارەوە دەبەستێت",
    en: "Right-click any tracking or code to fasten the task to that record",
    ar: "انقر بالزر الأيمن على أي تتبع أو رمز لربط المهمة بذلك السجل",
    zh: "右键点击任意运单号或编号，即可将任务关联到该记录",
  },
  /** Said in the sleeping list, where the row has no room for more. */
  returnsAt: (when: string) => ({
    ku: `${when} دەگەڕێتەوە`,
    en: `back ${when}`,
    ar: `تعود ${when}`,
    zh: `${when} 返回`,
  }),
  /** Said the moment it is put down, so it is never simply gone. */
  backAt: (when: string) => ({
    ku: `خەوت — ${when} خۆی دەگەڕێتەوە`,
    en: `Put down — back ${when}`,
    ar: `تم تأجيلها — تعود ${when}`,
    zh: `已延后 — ${when} 自动返回`,
  }),
  openDays: (n: number) => ({
    ku: `${n} ڕۆژە کراوەیە`,
    en: `Open ${n} days`,
    ar: `مفتوحة منذ ${n} يوم`,
    zh: `已开启 ${n} 天`,
  }),
} as const;

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * When a sleeping task comes back, in words.
 *
 * The owner, 2026-09-25: he pressed "remind me tomorrow" and the task
 * vanished with nothing said. A task that disappears silently is a task
 * nobody trusts, so the moment it is put down the system says the hour it
 * returns, and the sleeping ones stay visible under the list.
 */
export function wakeWhenWords(until: Date | string, now: Date = new Date()): Words {
  const at = new Date(until);
  if (!Number.isFinite(at.getTime())) {
    return { ku: "دواتر", en: "later", ar: "لاحقاً", zh: "稍后" };
  }
  const clock = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (at.toDateString() === now.toDateString()) {
    return {
      ku: `ئەمڕۆ کاتژمێر ${clock}`,
      en: `today at ${clock}`,
      ar: `اليوم الساعة ${clock}`,
      zh: `今天 ${clock}`,
    };
  }
  if (at.toDateString() === tomorrow.toDateString()) {
    return {
      ku: `سبەی کاتژمێر ${clock}`,
      en: `tomorrow at ${clock}`,
      ar: `غداً الساعة ${clock}`,
      zh: `明天 ${clock}`,
    };
  }
  const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  return {
    ku: `${day} کاتژمێر ${clock}`,
    en: `${day} at ${clock}`,
    ar: `${day} الساعة ${clock}`,
    zh: `${day} ${clock}`,
  };
}

/**
 * The short lesson, written where the list is.
 *
 * The owner, 2026-09-25: "add a little teaching — what a task is, the
 * shortcut and how it works, like a small guide, so the person knows what a
 * task means." Six lines, in the one place somebody looks when they have no
 * tasks yet and are wondering what the icon is for.
 */
export const TASK_GUIDE: readonly { title: Words; body: Words }[] = [
  {
    title: { ku: "تاسک چییە؟", en: "What is a task?", ar: "ما هي المهمة؟", zh: "什么是任务？" },
    body: {
      ku: "کارێک کە سیستەم خۆی نازانێت کەی تەواو دەبێت — نمونە پارچەیەک بە هەڵە بۆ کەسێکی تر چووە. تا خۆت نەڵێی تەواو بوو، لەبیر ناچێت.",
      en: "A job the system can never know is finished — a piece that went to the wrong person, say. It stays until a person ticks it.",
      ar: "عمل لا يمكن للنظام أن يعرف متى انتهى — قطعة ذهبت للشخص الخطأ مثلاً. تبقى حتى يؤكد شخص إنجازها.",
      zh: "系统永远无法自行判断是否完成的事——比如一件包裹发错了人。只有人确认后它才消失。",
    },
  },
  {
    title: { ku: "چۆن دروستی دەکەیت", en: "How to make one", ar: "كيف تنشئها", zh: "如何创建" },
    body: {
      ku: "کلیکی لای ڕاست لەسەر هەر تراک، کۆدی بۆکس یان کۆدی کڕیارێک — پەنجەرەکە بەو تۆمارەوە بەستراو دەکرێتەوە. یان ⁦Alt+T⁩ لە هەر شوێنێک، یان دوگمەی «تاسکێکی نوێ» لە سەرەوەی ئەم لیستە.",
      en: "Right-click any tracking, box code or customer code — the window opens already fastened to it. Or Alt+T from anywhere, or the + button here.",
      ar: "انقر بالزر الأيمن على أي تتبع أو رمز صندوق أو رمز زبون — تفتح النافذة مرتبطة به. أو ⁦Alt+T⁩ من أي مكان، أو زر «مهمة جديدة» أعلى هذه القائمة.",
      zh: "右键点击任意运单号、箱号或客户编号——窗口会自动关联该记录。也可随处按 Alt+T，或点此处的 + 按钮。",
    },
  },
  {
    title: { ku: "بۆچی بەستراوە بە تۆمارێکەوە", en: "Why it is fastened to a record", ar: "لماذا ترتبط بسجل", zh: "为何关联记录" },
    body: {
      ku: "چونکە بەستراوە، وشەکان کورت دەبن: «پارچەکە وەربگرەوە» بەسە کاتێک ژمارەکەی لەگەڵدایە — و بە کلیکێک دەگەڕێیتەوە بۆ تۆمارەکە.",
      en: "Because it is fastened, the words can be short: \"get the piece back\" is enough when the number travels with it — and one click goes back to the record.",
      ar: "لأنها مرتبطة، تكفي كلمات قليلة: «استرجع القطعة» كافية عندما يرافقها الرقم — ونقرة واحدة تعيدك إلى السجل.",
      zh: "因为已关联，措辞可以很短：「把件取回来」就够了，编号随任务一起走——点一下即可回到该记录。",
    },
  },
  {
    title: { ku: "کێ دەیبینێت", en: "Who sees it", ar: "من يراها", zh: "谁能看到" },
    body: {
      ku: "تەنها تۆ و ئەو کەسەی بۆت ناردووە. تاسکی شەخسی خۆت تەنها لای خۆتە — لیستێکی گشتی نییە بۆ هەموو ئۆفیس.",
      en: "Only you and the person you sent it to. Your own reminders are yours — there is no office-wide list.",
      ar: "أنت والشخص الذي أرسلتها إليه فقط. تذكيراتك الخاصة تبقى لك — لا توجد قائمة عامة للمكتب.",
      zh: "只有你和你指派的人。私人提醒只属于你——没有全公司可见的清单。",
    },
  },
  {
    title: { ku: "ڕەنگەکان", en: "The colours", ar: "الألوان", zh: "颜色含义" },
    body: {
      ku: "ئەمڕۆ ئاسایی، دوای 2 ڕۆژ زەرد، دوای 7 ڕۆژ سوور. تاسکی ئەمڕۆ شکست نییە، بۆیە لە یەکەم کاتژمێرەوە سووری ناکەین.",
      en: "Today is plain, after 2 days amber, after 7 days red. A task written this morning is not a failure, so it is not coloured like one.",
      ar: "اليوم عادية، بعد يومين كهرمانية، بعد 7 أيام حمراء. مهمة كُتبت هذا الصباح ليست فشلاً.",
      zh: "当天为普通色，2 天后转琥珀色，7 天后转红色。今早写下的任务不是失误，不该一开始就标红。",
    },
  },
  {
    title: { ku: "«سبەی بیرم بخەرەوە»", en: "\"Remind me tomorrow\"", ar: "«ذكّرني غداً»", zh: "「明天提醒我」" },
    body: {
      ku: "تاسکەکە نەسڕاوەتەوە — تا بەیانی کاتژمێر 08:00 دەخەوێت و پاشان خۆی دەگەڕێتەوە ناو لیستەکە. تا ئەو کاتە لە ژێر «خەوتوو» دەیبینیت و دەتوانیت ئێستا بیهێنیتەوە.",
      en: "Nothing is deleted — it sleeps until 8:00 tomorrow morning and comes back by itself. Until then it sits under \"Sleeping\", and you can wake it now.",
      ar: "لا شيء يُحذف — تنام حتى الساعة 08:00 صباح الغد ثم تعود وحدها. حتى ذلك الحين تجدها تحت «نائمة» ويمكنك إيقاظها الآن.",
      zh: "不会被删除——它会睡到明早 8:00 自动回到列表。在那之前它在「已延后」中，可随时唤醒。",
    },
  },
  {
    title: { ku: "تەواوکردن", en: "Finishing it", ar: "إنهاؤها", zh: "完成任务" },
    body: {
      ku: "چوارگۆشەکەی لای تاسکەکە داگرە. تەنها کەس دەیخات — هیچ شتێکی تر لە سیستەم ناتوانێت تاسکێک بخاتەوە.",
      en: "Tick the little box beside it. Only a person closes a task — nothing else in the system can.",
      ar: "أشّر على المربع بجانبها. الشخص وحده يغلق المهمة — لا شيء آخر في النظام يستطيع.",
      zh: "勾选旁边的小方框。只有人能关闭任务——系统中没有任何其他机制可以。",
    },
  },
];
