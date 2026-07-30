/**
 * Pure helpers for the commission edit form (CommissionForm in edit mode).
 * Kept out of the component so they can be unit-tested without React.
 */

/**
 * A failed mutation's `message` is not always a sentence. Validation errors
 * arrive as a serialized blob that can embed the whole payload — including a
 * base64 product image — and dumping that into a toast filled the screen with
 * unreadable data instead of telling anyone what went wrong. Only show the
 * message when it actually looks like a message.
 */
export function readableError(raw: string | undefined, fallback: string): string {
  const msg = (raw || "").trim();
  if (!msg) return fallback;
  if (msg.length > 300) return fallback;
  if (/data:image|base64|^[[{]/.test(msg)) return fallback;
  return msg;
}

/**
 * The set of fields the edit form can actually change, in a stable shape, so
 * we can tell "saved with no edits" from a real change without asking the
 * server. Deliberately excludes:
 *  - `sellPriceUsd`, a UI-only helper (buy + commission) that is never sent
 *  - the advance-payment fields, which edit mode never sends
 */
export function editableSnapshot(
  f: { [k: string]: unknown },
  images: string[],
): string {
  return JSON.stringify([
    f.customerId, f.supplierId, f.platform, f.orderNumber, f.trackingNumber, f.productLink,
    f.productDescription, f.quantity, f.color, f.size, f.productType,
    f.itemPriceUsd, f.commissionFeeUsd, f.notes, f.shippingType, f.weightKg,
    f.dimensionLength, f.dimensionWidth, f.dimensionHeight, f.volumeCbm,
    images.join("|"),
  ]);
}
