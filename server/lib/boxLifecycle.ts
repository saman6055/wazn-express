/**
 * The steps a delivery box goes through, each written once.
 *
 * A box is sealed, sent out (which posts its delivery fee to the customer's
 * account), and delivered (which marks every parcel and linked order in it
 * delivered). Those steps lived inline in the scanner's procedures. The
 * owner's rule — a box paid for in full is finished: delivered, closed and
 * archived — needs the same steps from the payment door, and a second copy of
 * the fee code is exactly how a fee gets posted twice or not at all. So they
 * live here, and both doors call them.
 */

import * as db from "../db";
import { appLogger } from "../utils/logger";
import { SETTLED_SLACK_USD } from "@shared/archive";
import { DELIVERY_FEE_IN_OUR_ACCOUNTS } from "@shared/deliveryFee";
import type { DeliveryBox } from "../../drizzle/schema/packages.schema";

/**
 * Post the box's delivery fee to the customer's account, once.
 *
 * Moved unchanged from the markInTransit procedure: an invoice for the fee,
 * the charge on the wallet, and the box flagged as charged so it is never
 * posted again. Nothing to do for a box with no fee or one already charged.
 * Throws on failure; each caller decides what a failure means for it.
 */
export async function chargeBoxDeliveryFee(box: DeliveryBox, userId: number): Promise<void> {
  // Owner, 2026-09-10: the local delivery fee is the courier's, not ours —
  // it does not go on the customer's account for now. See shared/deliveryFee.ts.
  if (!DELIVERY_FEE_IN_OUR_ACCOUNTS) return;
  const deliveryCharge = Number(box.deliveryChargeUsd || 0);
  if (!(deliveryCharge > 0) || box.isCharged) return;

  const customer = await db.getCustomerById(box.customerId);
  if (!customer) return;

  // Create invoice for delivery charge
  const items = await db.getBoxItems(box.id);
  const lineItems = [{
    description: `نرخی گەیاندنی بۆکس ${box.boxCode} (${items.length} پاکەت) - ${box.destinationCity || 'ناوخۆیی'}`,
    quantity: 1,
    unitPrice: deliveryCharge,
    total: deliveryCharge,
  }];
  const invoiceNumber = `INV-BOX-${Date.now()}-${box.id}`;
  const invoice = await db.createInvoice({
    invoiceNumber,
    customerId: box.customerId,
    subtotalUsd: deliveryCharge.toFixed(2),
    totalUsd: deliveryCharge.toFixed(2),
    status: "issued",
    issuedAt: new Date(),
    lineItems,
    notes: `پسووڵەی گەیاندنی بۆکس ${box.boxCode} بۆ ${box.destinationCity || 'ناوخۆیی'}`,
    createdById: userId,
  });

  // Charge wallet
  await db.recordPackageChargeWithoutInvoice(
    box.customerId,
    customer.customerCode,
    0, // no specific package
    deliveryCharge,
    `نرخی گەیاندنی بۆکس ${box.boxCode}`,
    userId,
    invoice.id
  );

  await db.updateDeliveryBox(box.id, {
    isCharged: true,
    invoiceId: invoice.id,
  });

  appLogger.info("[DeliveryBox] Charged customer for box delivery", { boxCode: box.boxCode, charge: deliveryCharge, customerId: box.customerId });
}

/**
 * Mark every parcel and linked order in the box delivered.
 *
 * Moved unchanged from the markDelivered procedure. One parcel that fails is
 * logged and the rest carry on, as before.
 */
export async function markBoxContentsDelivered(
  boxId: number,
  userId: number,
  signature?: string,
  deliveryPhoto?: string,
): Promise<void> {
  const items = await db.getBoxItems(boxId);
  for (const item of items) {
    if (item.packageId) {
      try {
        await db.updatePackage(item.packageId, {
          status: 'delivered',
          deliveredAt: new Date(),
          deliveredById: userId,
          recipientSignature: signature,
          deliveryPhoto,
        });
      } catch (e) {
        appLogger.error("[DeliveryBox] Failed to update package status", { packageId: item.packageId, error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (item.fullPackageOrderId) {
      try {
        await db.updateFullPackageOrder(item.fullPackageOrderId, {
          status: 'delivered',
          deliveredDate: new Date(),
          actualDeliveryDate: new Date(),
        }, userId);
      } catch (e) {
        appLogger.error("[DeliveryBox] Failed to update FP order status", { fpOrderId: item.fullPackageOrderId, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
}

export type FinishPaidBoxResult = {
  /** The box is delivered and, being paid for, drops into the archive. */
  finished: boolean;
  /** Why it could not be finished, when something went wrong. The payment
   *  itself is saved either way. */
  error: string | null;
};

/**
 * The owner's rule: a box paid for in full is finished — delivered, closed
 * and archived at once — and nothing is lost on the way.
 *
 * "Paid in full" is what the settlement screen itself says: nothing
 * outstanding on any line, after corrections, discounts and held parcels.
 * A part-paid box, or one with a parcel held back, is still work and is left
 * alone.
 *
 * It then goes through the same steps a person would take, in order, so no
 * step's bookkeeping is skipped: sealed if still open, its delivery fee
 * posted if it has one and it was never sent out, its parcels and orders
 * marked delivered, then the box. The "on its way" message is not sent — the
 * box is being handed over, not dispatched.
 *
 * Never throws. It runs after the payment is committed, and a failure to
 * finish must not read as a failure to pay; the caller shows the reason.
 */
export async function finishPaidBox(boxId: number, userId: number): Promise<FinishPaidBoxResult> {
  try {
    let box = await db.getDeliveryBoxById(boxId);
    if (!box || box.status === "cancelled") return { finished: false, error: null };

    const view = await db.getBoxSettlementView(boxId);
    const lines = view.parcels ?? [];
    const paidInFull = lines.length > 0 && lines.every((p) => Number(p.outstandingUsd) <= SETTLED_SLACK_USD);
    if (!paidInFull) return { finished: false, error: null };

    if (box.status === "delivered") return { finished: true, error: null };

    if (box.status === "open") {
      if (!box.totalPackages) return { finished: false, error: null };
      box = (await db.sealBox(boxId, userId)) ?? box;
    }

    await chargeBoxDeliveryFee(box, userId);
    await markBoxContentsDelivered(boxId, userId);
    await db.markBoxDelivered(boxId, userId);

    appLogger.info("[DeliveryBox] Paid in full — sealed, delivered and archived", { boxId, boxCode: box.boxCode });
    return { finished: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appLogger.error("[DeliveryBox] A paid box could not be finished", { boxId, error: message });
    return { finished: false, error: message };
  }
}
