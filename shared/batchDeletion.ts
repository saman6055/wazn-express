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
 *      admin may undo it. After that, deleting is a decision rather than a
 *      correction, and it takes a super admin.
 *
 *   3. Parcels. Packages scanned into the batch do NOT block it. They are
 *      released back to unassigned and survive the deletion — that is the
 *      whole case the feature exists for. They are counted here only so the
 *      warning can say how many are about to be released.
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
  | "needs_super_admin"
  | "not_permitted"
  | "already_finished";

export interface DeletionVerdict {
  allowed: boolean;
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

  // 3. After that it takes a super admin.
  if (isSuperAdmin(params.role)) return { ...base, allowed: true, wouldSuperAdminHelp: false };

  return { ...base, allowed: false, refusal: "needs_super_admin", wouldSuperAdminHelp: true };
}

export const REFUSAL_MESSAGE: Record<DeletionRefusal, { ku: string; en: string; ar: string; zh: string }> = {
  has_financial_records: {
    ku: "ناتوانرێت بسڕدرێتەوە — پسوڵە یان سندوقی گەیاندن یان داواکاری پێوەی بەستراوە. پارە لەسەری ژمێردراوە",
    en: "Cannot be deleted — invoices, delivery boxes or orders are tied to it. Money has been counted against it",
    ar: "لا يمكن الحذف — توجد فواتير أو صناديق تسليم أو طلبات مرتبطة به. تم احتساب أموال عليه",
    zh: "无法删除 — 有发票、配送箱或订单与之关联，已计入款项",
  },
  needs_super_admin: {
    ku: "زیاتر لە ٢٤ کاتژمێری بەسەردا تێپەڕیوە — پێویستی بە ڕەزامەندی سوپەر ئەدمینە",
    en: "More than 24 hours old — this needs a super admin",
    ar: "مضى أكثر من ٢٤ ساعة — يتطلب موافقة مشرف عام",
    zh: "已超过 24 小时 — 需要超级管理员",
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
