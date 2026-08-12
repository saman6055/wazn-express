/**
 * What the recycle bin holds, and what may be done with it.
 *
 * Two deletion models exist in this system and the bin presents both:
 *
 *  - a snapshot in `deletedRecords`, for things nothing else references. The
 *    row is genuinely gone; the bin is the only record of it. Restoring
 *    re-inserts it.
 *  - a `deletedAt` marker on the row itself, for things that ARE referenced
 *    and whose history has to survive — a full-package order is linked to
 *    parcels, invoices and a ledger entry. Restoring clears the marker.
 *
 * Which model a type uses is a property of that type, not something the bin
 * chooses. What the bin guarantees is that both look the same to whoever is
 * trying to undo a mistake.
 */

export type TrashEntityType = "batch" | "full_package_order";

export interface TrashEntityDefinition {
  type: TrashEntityType;
  /** How this type is stored while deleted. */
  storage: "snapshot" | "marker";
  labelKu: string;
  label: string;
  labelAr: string;
  labelZh: string;
}

export const TRASH_ENTITIES: readonly TrashEntityDefinition[] = [
  {
    type: "batch",
    storage: "snapshot",
    labelKu: "باچ",
    label: "Batch",
    labelAr: "دفعة",
    labelZh: "批次",
  },
  {
    type: "full_package_order",
    storage: "marker",
    labelKu: "داواکاری پاکێجی تەواو",
    label: "Full package order",
    labelAr: "طلب حزمة كاملة",
    labelZh: "完整套餐订单",
  },
];

export function trashEntity(type: string): TrashEntityDefinition | undefined {
  return TRASH_ENTITIES.find((e) => e.type === type);
}

/** One row of the bin, whichever model it came from. */
export interface TrashItem {
  /** Unique within the bin: the entity type plus its id. */
  key: string;
  entityType: TrashEntityType;
  entityId: number;
  label: string;
  deletedAt: Date | string;
  deletedByName?: string | null;
  deletionReason?: string | null;
}

/**
 * Why a record cannot be put back.
 *
 * Restoring is not the reverse of deleting: the world moved on while the
 * record was gone. A batch code may have been reused, the customer an order
 * belonged to may itself be deleted. A restore that ignores this quietly
 * creates a duplicate or a dangling reference, so every restore states its
 * reason for refusing instead.
 */
export type RestoreBlockedReason = "label_taken" | "already_present" | "owner_missing";

export const RESTORE_BLOCKED_MESSAGE: Record<RestoreBlockedReason, {
  ku: string; en: string; ar: string; zh: string;
}> = {
  label_taken: {
    ku: "ناوەکە لەم ماوەیەدا بۆ تۆمارێکی تر بەکارهاتووە",
    en: "That name has been taken by another record since",
    ar: "تم استخدام هذا الاسم لسجل آخر منذ ذلك الحين",
    zh: "该名称此后已被另一条记录使用",
  },
  already_present: {
    ku: "پێشتر گەڕێنراوەتەوە",
    en: "It has already been restored",
    ar: "تمت استعادته بالفعل",
    zh: "已经恢复过了",
  },
  owner_missing: {
    ku: "ئەو تۆمارەی پێوەی بەستراوە ئێستا بوونی نییە",
    en: "The record it belonged to no longer exists",
    ar: "السجل الذي ينتمي إليه لم يعد موجودًا",
    zh: "它所属的记录已不存在",
  },
};
