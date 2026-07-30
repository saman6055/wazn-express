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
/**
 * What to put in an order payload's `advancePaidUsd`.
 *
 * The server treats a PRESENT advance as intent and moves money on the
 * customer's ledger, so "no advance entered" must send nothing at all — not
 * "0" and not "0.00". A typed zero is a truthy string, so the obvious
 * `field || undefined` would still post it.
 */
export function advancePayload(raw: string | null | undefined): string | undefined {
  const value = (raw ?? "").trim();
  if (!value) return undefined;
  const amount = parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return value;
}

/**
 * A numeric field's value for an order payload.
 *
 * Weight, dimensions, CBM and the prices are DECIMAL columns. An empty text
 * input hands back `""`, and MySQL rejects that outright — "Incorrect decimal
 * value: ''" — failing the ENTIRE update, so a rename or a price fix silently
 * refused to save just because the weight box was blank. `undefined` means
 * "leave this column alone", which is what an untouched field should do.
 */
export function numericPayload(raw: string | null | undefined): string | undefined {
  const value = (raw ?? "").trim();
  if (!value) return undefined;
  return Number.isFinite(Number(value)) ? value : undefined;
}

export function editableSnapshot(
  f: { [k: string]: unknown },
  images: string[],
): string {
  return JSON.stringify([
    f.customerId, f.supplierId, f.platform, f.orderNumber, f.trackingNumber, f.productLink,
    f.productDescription, f.quantity, f.color, f.size, f.productType,
    // Commission prices AND full-package prices — this snapshot backs the
    // "nothing changed" check on both forms, and a missing field here would
    // silently discard a real edit.
    f.itemPriceUsd, f.commissionFeeUsd, f.purchasePriceUsd, f.sellingPriceUsd,
    f.notes, f.shippingType, f.weightKg,
    f.dimensionLength, f.dimensionWidth, f.dimensionHeight, f.volumeCbm,
    images.join("|"),
  ]);
}
