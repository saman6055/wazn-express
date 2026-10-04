/**
 * When a batch may be deleted, and by whom.
 *
 * A batch created by mistake has to be undoable — wrong type, wrong
 * destination, parcels scanned into the wrong shipment. But a batch stops
 * being a mistake and starts being a record: once it has been invoiced,
 * boxed for delivery or tied to a full-package order, money has been counted
 * against it and deleting it would break arithmetic somebody has already
 * relied on.
 *
 * So three gates, in order of severity:
 *
 *   1. Money. If anything financial points at this batch, no one may delete
 *      it — not an admin, not a super admin, not on the first day. That is
 *      not a permission problem, and a bigger role does not make it safe.
 *
 *   2. Time. Inside the first day it is still plausibly a mistake, and an
 *      admin may undo it. After that nobody may — not an admin, not a super
 *      admin. A day-old batch has been scanned into, looked at and worked
 *      from; by then deleting it is not correcting a mistake, it is removing
 *      a record, and the escalation path only ever made that easier to do.
 *
 *   3. Parcels. Packages scanned into the batch do NOT block it. They are
 *      released back to unassigned and survive the deletion — that is the
 *      whole case the feature exists for. They are counted here only so the
 *      warning can say how many are about to be released.
 *
 * The main admin stands outside all three (owner, 2026-10-04: "add the power
 * to delete a batch for the main admin"). A test batch like AIR-2026-007 had
 * lived for five months, delivered and invoiced, and nobody could remove it.
 * He may delete any batch at any age; when money points at it he is asked
 * once, with the invoices, boxes and orders named, and told they stay where
 * they are. Every deletion goes to the recycle bin and can be restored.
 */

/** How long a batch stays plainly undoable by an admin. */
export const DELETE_GRACE_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/** Roles that may delete outside the grace period. */
export type UserRole = string;
export const isSuperAdmin = (role: UserRole | null | undefined): boolean =>
  role === "super_admin";
export const isAdmin = (role: UserRole | null | undefined): boolean =>
  role === "admin" || role === "super_admin";

/** Things that mean money has been counted against this batch. */
export interface FinancialTies {
  invoices: number;
  deliveryBoxes: number;
  fullPackageOrders: number;
}

export type DeletionRefusal =
  | "has_financial_records"
  | "too_old"
  | "not_permitted"
  | "already_finished";

export interface DeletionVerdict {
  allowed: boolean;
  /**
   * Allowed for the main admin, but money points at the batch: ask him first,
   * naming what stays (see tiesQuestion).
   */
  asksAboutTies?: boolean;
  /** Why not, when not. */
  refusal?: DeletionRefusal;
  /** True when a super admin could do what this caller cannot. */
  wouldSuperAdminHelp: boolean;
  /** Whole hours since the batch was created. */
  ageHours: number;
  withinGrace: boolean;
}

export function financialTieCount(ties: FinancialTies): number {
  return ties.invoices + ties.deliveryBoxes + ties.fullPackageOrders;
}

/** Statuses where the shipment is over and deleting is not a correction. */
export const FINISHED_STATUSES = ["delivered", "closed"] as const;

export function hoursSince(createdAt: Date | string | null | undefined, now: Date = new Date()): number {
  if (!createdAt) return Number.POSITIVE_INFINITY;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - created.getTime()) / HOUR_MS);
}

/**
 * May this caller delete this batch?
 *
 * `now` is a parameter so the rule is testable and so a screen rendered once
 * does not change its mind between rendering the button and pressing it.
 */
export function canDeleteBatch(params: {
  role: UserRole | null | undefined;
  status?: string | null;
  createdAt?: Date | string | null;
  ties: FinancialTies;
  now?: Date;
}): DeletionVerdict {
  const now = params.now ?? new Date();
  const ageHours = hoursSince(params.createdAt, now);
  const withinGrace = ageHours < DELETE_GRACE_HOURS;

  const base = { ageHours, withinGrace };

  // 0. The main admin may delete any batch, at any age and in any state.
  //    If money points at it he is asked first — never refused.
  if (isSuperAdmin(params.role)) {
    return {
      ...base,
      allowed: true,
      asksAboutTies: financialTieCount(params.ties) > 0,
      wouldSuperAdminHelp: false,
    };
  }

  // 1. Money first. A bigger role does not make this safe, so there is no
  //    point telling the caller to go and find a super admin.
  if (financialTieCount(params.ties) > 0) {
    return { ...base, allowed: false, refusal: "has_financial_records", wouldSuperAdminHelp: false };
  }

  // A delivered or closed batch is history, not a mistake being corrected.
  // Archiving is what hides those; deleting them would remove a shipment
  // customers were told about.
  if (params.status && (FINISHED_STATUSES as readonly string[]).includes(params.status)) {
    return { ...base, allowed: false, refusal: "already_finished", wouldSuperAdminHelp: false };
  }

  if (!isAdmin(params.role)) {
    return { ...base, allowed: false, refusal: "not_permitted", wouldSuperAdminHelp: false };
  }

  // 2. Inside the first day, an admin may undo their own mistake.
  if (withinGrace) return { ...base, allowed: true, wouldSuperAdminHelp: false };

  // 3. After that, nobody. A super admin is not told to come and help,
  //    because a super admin cannot help either — this is a rule about the
  //    age of the record, not about who is asking.
  return { ...base, allowed: false, refusal: "too_old", wouldSuperAdminHelp: false };
}

export const REFUSAL_MESSAGE: Record<DeletionRefusal, { ku: string; en: string; ar: string; zh: string }> = {
  has_financial_records: {
    ku: "ناتوانرێت بسڕدرێتەوە — پسوڵە یان سندوقی گەیاندن یان داواکاری پێوەی بەستراوە. پارە لەسەری ژمێردراوە",
    en: "Cannot be deleted — invoices, delivery boxes or orders are tied to it. Money has been counted against it",
    ar: "لا يمكن الحذف — توجد فواتير أو صناديق تسليم أو طلبات مرتبطة به. تم احتساب أموال عليه",
    zh: "无法删除 — 有发票、配送箱或订单与之关联，已计入款项",
  },
  too_old: {
    ku: "زیاتر لە 24 کاتژمێری بەسەردا تێپەڕیوە — ئیتر ناسڕدرێتەوە. دۆخەکەی بگۆڕە یان بیخە ئەرشیفەوە",
    en: "More than 24 hours old — it can no longer be deleted. Change its status or archive it",
    ar: "مضى أكثر من 24 ساعة — لم يعد قابلاً للحذف. غيّر حالته أو أرشفه",
    zh: "已超过 24 小时——不能再删除。请更改其状态或归档",
  },
  not_permitted: {
    ku: "دەسەڵاتی سڕینەوەت نییە",
    en: "You do not have permission to delete",
    ar: "ليس لديك صلاحية الحذف",
    zh: "您没有删除权限",
  },
  already_finished: {
    ku: "ئەم باچە گەیەنراوە یان داخراوە — ئەرشیفی بکە لەبری سڕینەوە",
    en: "This batch is delivered or closed — archive it rather than delete it",
    ar: "تم تسليم هذه الدفعة أو إغلاقها — أرشفها بدلاً من حذفها",
    zh: "该批次已交付或已关闭 — 请归档而非删除",
  },
};

/** Marks the main admin's question so the form asks instead of failing. */
export const BATCH_TIES_MARK = "[[batch-ties]]";

/** The question put to the main admin before a batch with money on it goes. */
export function tiesQuestion(batchCode: string, ties: FinancialTies, packages: number): string {
  const lines = [
    ties.invoices > 0 ? `• ${ties.invoices} پسوولە` : null,
    ties.deliveryBoxes > 0 ? `• ${ties.deliveryBoxes} بۆکسی گەیاندن` : null,
    ties.fullPackageOrders > 0 ? `• ${ties.fullPackageOrders} ئۆردەر` : null,
  ].filter(Boolean).join("\n");
  return (
    `${BATCH_TIES_MARK}باچی ${batchCode} شتی پارەی پێوە بەستراوە:\n${lines}\n\n` +
    "ئەگەر بیسڕیتەوە، ئەمانە وەک خۆیان دەمێننەوە — هیچ پسوولە، وەسڵ یان پارەیەک ناسڕدرێتەوە. " +
    (packages > 0 ? `${packages} پاکەتی ناوی دەگەڕێنەوە بۆ «بێ باچ». ` : "") +
    "باچەکە دەچێتە سەتڵی خۆڵ و دەتوانرێت بگەڕێندرێتەوە.\n\nدڵنیایت دەیسڕیتەوە؟"
  );
}

export function isTiesQuestion(message: string | null | undefined): boolean {
  return !!message && message.startsWith(BATCH_TIES_MARK);
}
