import { eq, inArray } from "drizzle-orm";
import { getDb } from "./connection";
import { batches, customers, packages } from "../../drizzle/schema";
import { getBatchCloseFacts } from "./batchCloseCheck.db";
import { boxChoiceForCustomer, setBoxHandover } from "./boxHandover.db";
import { addItemToBox, buildBoxItemValuesFromPackage, createDeliveryBox, foreignOrderInBox } from "./deliveryBoxes.db";

export interface UnboxedResult {
  customers: number;
  boxesMade: number;
  parcelsIn: number;
  leftOut: Array<{ packageCode: string; why: "foreign_order" | "failed" }>;
}

/**
 * Every carton the close check calls unboxed goes into its customer's box, at
 * one press (owner, 2026-11-02). The customer's box still being filled if
 * there is one; else a new box made the way their newest one went out.
 *
 * Code by code, every tracking the code has (owner, 2026-11-02: «هەر کۆدەی
 * چەند تراکی هەیە ئەوان بخەرە بۆکس») - a carton not yet arrival-checked goes
 * in too. Only a carton with no owner stays out. A parcel that fails stays out
 * and is reported; the rest are not held back by it.
 */
export async function putUnboxedInBoxes(batchId: number, userId: number): Promise<UnboxedResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const facts = await getBatchCloseFacts(batchId);
  const ids = (facts.unboxed ?? []).map((p) => p.id);
  const result: UnboxedResult = { customers: 0, boxesMade: 0, parcelsIn: 0, leftOut: [] };
  if (ids.length === 0) return result;

  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  const rows = await db.select().from(packages).where(inArray(packages.id, ids));
  const byCustomer = new Map<number, typeof rows>();
  for (const p of rows) {
    if (!p.customerId) continue;
    byCustomer.set(p.customerId, [...(byCustomer.get(p.customerId) ?? []), p]);
  }

  for (const [customerId, parcels] of Array.from(byCustomer.entries())) {
    result.customers += 1;
    const choice = await boxChoiceForCustomer(customerId);
    let boxId = choice.open?.id ?? null;
    if (boxId == null) {
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      const last = choice.last;
      const box = await createDeliveryBox({
        customerId,
        batchId,
        deliveryMethod: last?.deliveryMethod ?? "warehouse_pickup",
        destinationCity: last?.destinationCity ?? customer?.city ?? undefined,
        destinationAddress: last?.destinationAddress ?? undefined,
        recipientName: customer?.fullName ?? undefined,
        recipientPhone: last?.recipientPhone ?? customer?.mobileNumber ?? undefined,
        deliveryCostUsd: last?.deliveryCostUsd ?? "0",
        deliveryChargeUsd: last?.deliveryChargeUsd ?? "0",
        createdById: userId,
      });
      boxId = Number(box.id);
      result.boxesMade += 1;
      const mode = last?.handoverMode ?? (!last || last.deliveryMethod === "warehouse_pickup" ? "pickup" : null);
      // The box stands either way; its card asks for the way again.
      if (mode) await setBoxHandover({ boxId, mode, carrierId: last?.carrierId ?? null }, userId).catch(() => undefined);
    }
    for (const pkg of parcels) {
      try {
        if (await foreignOrderInBox(customerId, { packageId: pkg.id })) {
          result.leftOut.push({ packageCode: pkg.packageCode, why: "foreign_order" });
          continue;
        }
        const values = await buildBoxItemValuesFromPackage(pkg, batch, userId);
        await addItemToBox({ boxId, ...values });
        result.parcelsIn += 1;
      } catch {
        result.leftOut.push({ packageCode: pkg.packageCode, why: "failed" });
      }
    }
  }
  return result;
}
