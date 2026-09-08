/**
 * The hand-off between the two order forms' quick-switch buttons.
 *
 * The owner's ask (Sep 2026): from a half-typed full-package order you can
 * jump to cost-purchase (commission) and back, and everything already
 * filled goes along — customer, shipping, product, images — while the
 * money section starts over, because the two services price differently.
 *
 * The carried fields are listed ONCE here; price fields are excluded by
 * not being on the list, which is the whole safety of it.
 */

export const ORDER_FORM_DRAFT_FIELDS = [
  "customerId",
  "supplierId",
  "platform",
  "orderNumber",
  "trackingNumber",
  "productLink",
  "productDescription",
  "quantity",
  "color",
  "size",
  "productType",
  "notes",
  "shippingType",
  "weightKg",
  "dimensionLength",
  "dimensionWidth",
  "dimensionHeight",
  "volumeCbm",
] as const;

export type OrderFormDraftField = (typeof ORDER_FORM_DRAFT_FIELDS)[number];

export type OrderFormDraft = Record<OrderFormDraftField, string> & {
  productImages: string[];
};

/** The carried subset of a form's state — never the money fields. */
export function pickOrderFormDraft(
  source: Record<string, unknown>,
  productImages: string[],
): OrderFormDraft {
  const draft = {} as Record<OrderFormDraftField, string>;
  for (const field of ORDER_FORM_DRAFT_FIELDS) {
    draft[field] = String(source[field] ?? "");
  }
  return { ...draft, productImages };
}

const KEY = "wazn.orderFormSwitchDraft";

/** Survives the route change, not the tab — sessionStorage on purpose. */
export function stashOrderFormDraft(draft: OrderFormDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage refused (private mode etc.) — the switch still navigates,
    // it just arrives empty-handed.
  }
}

/** Read once and clear, so a later plain visit starts clean. */
export function takeOrderFormDraft(): OrderFormDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<OrderFormDraft>;
    return {
      ...pickOrderFormDraft(parsed as Record<string, unknown>, []),
      productImages: Array.isArray(parsed.productImages)
        ? parsed.productImages.filter((u): u is string => typeof u === "string")
        : [],
    };
  } catch {
    return null;
  }
}
