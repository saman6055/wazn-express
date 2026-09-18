/**
 * When a customer's declared tracking can be given its parcel from the Portal
 * Center (owner, 2026-09-18, phase 2).
 *
 * A declaration is the customer saying "this tracking is mine" before the
 * parcel arrives. Registration matches it by itself when the parcel is
 * registered with its owner. What it cannot do is give an owner to a parcel
 * registered without one — registered before the declaration existed, or
 * with the owner left out — and then the declaration waits while the parcel
 * sits nobody's. Staff can link the two, and only then: the declaration
 * still open, its customer known, the parcel in the warehouse and still
 * nobody's.
 *
 * Linking does what approving an ownership claim does, no more (the owner's
 * answer): the parcel gets its owner and its price; the charge follows the
 * rules it always has. Pure: no database.
 */

export type DeclaredLinkRefusal = "closed" | "no_customer" | "no_parcel" | "owned";

/** A declaration still waiting for its parcel. */
export const OPEN_DECLARATION_STATUSES = ["pending", "matched"] as const;

/** Returned or cancelled: gone from the warehouse, nothing to link. */
const ENDED = ["returned", "cancelled"];

export function declaredLinkRefusal(
  declaration: { status: string | null | undefined; customerId: number | null | undefined },
  parcel: { customerId: number | null | undefined; status: string | null | undefined } | null | undefined,
): DeclaredLinkRefusal | null {
  if (!(OPEN_DECLARATION_STATUSES as readonly string[]).includes(String(declaration.status ?? ""))) return "closed";
  if (!declaration.customerId) return "no_customer";
  if (!parcel || ENDED.includes(String(parcel.status ?? ""))) return "no_parcel";
  if (parcel.customerId) return "owned";
  return null;
}

export const DECLARED_LINK_REFUSAL_MESSAGE: Record<DeclaredLinkRefusal, { ku: string; en: string; ar: string; zh: string }> = {
  closed: {
    ku: "ئەم تراکینگە ئیتر چاوەڕوان نییە",
    en: "This declaration is no longer open",
    ar: "لم يعد هذا التصريح مفتوحاً",
    zh: "该申报已不再待处理",
  },
  no_customer: {
    ku: "ئەم تراکینگە کڕیاری لەسەر نییە",
    en: "This declaration has no customer",
    ar: "لا يوجد عميل لهذا التصريح",
    zh: "该申报没有客户",
  },
  no_parcel: {
    ku: "پاکەتێک بەم تراکە لە مەخزەن نییە",
    en: "No parcel with this tracking is in the warehouse",
    ar: "لا يوجد طرد بهذا الرقم في المستودع",
    zh: "仓库中没有此运单号的包裹",
  },
  owned: {
    ku: "ئەم پاکەتە پێشتر خاوەنی هەیە",
    en: "This parcel already has an owner",
    ar: "لهذا الطرد مالك بالفعل",
    zh: "该包裹已有所有者",
  },
};
