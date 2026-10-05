import { and, eq } from "drizzle-orm";
import { getDb } from "./connection";
import { packages, fullPackageOrders, fullPackageOrderTrackings, type Package } from "../../drizzle/schema";
import { getBatchById, getBatchRateForCustomer } from "./batches.db";
import { getCustomerById } from "./customers.db";
import { updatePackage } from "./packages.db";
import { recordPackageChargeWithoutInvoice, createRevenueRecord } from "./finance.db";
import { createInvoice } from "./invoices.db";
import { getVolumetricDivisor } from "./settings.db";
import { selfOrderConditions } from "./selfOrder.filter";
import { isSelfOrder } from "../lib/selfOrder";
import { batchChargesOnPricing } from "../lib/chargePolicy";
import { chargeableWeight } from "@shared/chargeableWeight";
import { appLogger } from "../utils/logger";

/**
 * Shipping debt the moment the price exists — the owner's 2026-09-09 rule.
 *
 * Called from every door that can make a parcel chargeable: the batch edit
 * that sets a price, every path that puts a parcel into a batch, and a claim
 * that gives an unclaimed parcel its owner. It is IDEMPOTENT — the isCharged
 * flag and this function are the only writers, so calling it after every
 * assignment costs one cheap query and can never charge twice. The
 * batch-delivered flow keeps its own charging as the safety net for old-rule
 * batches and anything this missed; it checks the same flag, so the two can
 * never overlap.
 *
 * Only self-order parcels charge here — the same shared rule the revenue
 * report and the portal use. A parcel claimed by a full-package or commission
 * order is billed through its order's own invoice, and charging it here too
 * would be the double-billing the isCharged flag was invented to stop.
 *
 * Rates resolve per customer through getBatchRateForCustomer (agreed rate
 * first, then tier, then the batch default) and weights through the shared
 * chargeable-weight rule with the configured divisor — the same answers the
 * register screen quotes and the invoice at delivery would have used.
 */
/**
 * One parcel's shipping, to the cent: what the batch sells, times the rate.
 *
 * Sea sells the cubic metres outright; air sells the greater of the scale and
 * the volumetric weight. The line below is the one the charge has always been
 * worked out with - lifted out so that a correction to a parcel asks the same
 * line what the parcel SHOULD have been charged, instead of keeping a copy
 * that could round a cent differently one day.
 */
export function parcelShippingCharge(
  pkg: Pick<Package, "weightKg" | "lengthCm" | "widthCm" | "heightCm" | "volumeCbm">,
  isSea: boolean,
  rate: number,
  divisor: number,
): { quantity: number; amount: number } {
  const quantity = isSea
    ? Number(pkg.volumeCbm ?? 0) || 0
    : chargeableWeight(pkg, divisor).chargeableKg;
  const amount = Math.round(quantity * rate * 100) / 100;
  return { quantity, amount };
}

/**
 * The line a parcel's shipping is written on its invoice with.
 *
 * Once, because a correction rewrites the same line with the corrected
 * figures and the two must read alike on paper.
 */
export function parcelInvoiceLine(
  name: string,
  isSea: boolean,
  rate: number,
  quantity: number,
  amount: number,
): { description: string; quantity: number; unitPrice: number; total: number } {
  const unitLabel = isSea ? "m³" : "kg";
  return {
    description: `پاکەت ${name}\nنرخ: ${quantity.toFixed(isSea ? 3 : 2)} ${unitLabel} × $${rate.toFixed(2)}/${unitLabel} = $${amount.toFixed(2)}`,
    quantity: 1,
    unitPrice: amount,
    total: amount,
  };
}

/**
 * Does any order claim this tracking number?
 *
 * The question selfOrderConditions asks in SQL, for one parcel in hand. Both
 * places an order can record a tracking are read.
 */
export async function orderClaimsTracking(trackingNumber: string | null | undefined): Promise<boolean> {
  const db = await getDb();
  if (!db || !trackingNumber) return false;
  const [direct] = await db.select({ id: fullPackageOrders.id }).from(fullPackageOrders)
    .where(eq(fullPackageOrders.trackingNumber, trackingNumber)).limit(1);
  if (direct) return true;
  const [listed] = await db.select({ id: fullPackageOrderTrackings.id }).from(fullPackageOrderTrackings)
    .where(eq(fullPackageOrderTrackings.trackingNumber, trackingNumber)).limit(1);
  return Boolean(listed);
}

export interface ShippingChargeDue {
  /** True when chargeBatchShippingIfDue would post a charge for this parcel now. */
  due: boolean;
  amount: number;
  rate: number;
  quantity: number;
  unit: "kg" | "cbm";
  batchCode: string | null;
}

/**
 * The charge this parcel would be given right now - asked, not given.
 *
 * The same gates as chargeBatchShippingIfDue, in the same order: a batch born
 * under the charge-on-pricing rule and carrying a price, a self-order parcel
 * with an owner, that owner's rate, and an amount above zero. Nothing is
 * written. A correction uses it to learn what a parcel's charge should stand
 * at after its weight or its owner was put right.
 */
export async function shippingChargeDueNow(
  pkg: Pick<
    Package,
    | "batchId" | "customerId" | "isUnclaimed" | "fullPackageOrderId" | "trackingNumber" | "registeredAt"
    | "weightKg" | "lengthCm" | "widthCm" | "heightCm" | "volumeCbm"
  >,
): Promise<ShippingChargeDue> {
  const none: ShippingChargeDue = { due: false, amount: 0, rate: 0, quantity: 0, unit: "kg", batchCode: null };
  const db = await getDb();
  if (!db || !pkg.batchId) return none;

  const batch = await getBatchById(pkg.batchId);
  if (!batch) return none;
  const isSea = batch.shippingType === "sea";
  const unit: "kg" | "cbm" = isSea ? "cbm" : "kg";
  const facts = { ...none, unit, batchCode: batch.batchCode ?? null };
  if (!batchChargesOnPricing(batch)) return facts;

  const hasClaimingOrder = await orderClaimsTracking(pkg.trackingNumber);
  const selfOrder = Boolean(pkg.trackingNumber) && isSelfOrder({
    fullPackageOrderId: pkg.fullPackageOrderId ?? null,
    hasClaimingOrder,
    customerId: pkg.customerId ?? null,
    isUnclaimed: Boolean(pkg.isUnclaimed),
    registeredAt: pkg.registeredAt ?? null,
  });
  if (!selfOrder) return facts;

  const { rate } = await getBatchRateForCustomer(pkg.batchId, pkg.customerId!, { unit });
  if (!(rate > 0)) return facts;

  const divisor = await getVolumetricDivisor();
  const { quantity, amount } = parcelShippingCharge(pkg, isSea, rate, divisor);
  return { ...facts, due: amount > 0, amount, rate, quantity };
}

export async function chargeBatchShippingIfDue(
  batchId: number,
  actorId: number,
): Promise<{ eligible: boolean; parcels: number; customers: number }> {
  const db = await getDb();
  if (!db) return { eligible: false, parcels: 0, customers: 0 };

  const batch = await getBatchById(batchId);
  if (!batch || !batchChargesOnPricing(batch)) {
    return { eligible: false, parcels: 0, customers: 0 };
  }

  const isSea = batch.shippingType === "sea";
  const unit: "kg" | "cbm" = isSea ? "cbm" : "kg";

  const rows = await db.select().from(packages).where(and(
    eq(packages.batchId, batchId),
    eq(packages.isCharged, false),
    ...selfOrderConditions(),
  ));
  if (rows.length === 0) return { eligible: true, parcels: 0, customers: 0 };

  const divisor = await getVolumetricDivisor();

  const byCustomer = new Map<number, typeof rows>();
  for (const pkg of rows) {
    const list = byCustomer.get(pkg.customerId!) ?? [];
    list.push(pkg);
    byCustomer.set(pkg.customerId!, list);
  }

  let charged = 0;
  let customersBilled = 0;

  for (const [customerId, parcels] of Array.from(byCustomer.entries())) {
    try {
      const { rate } = await getBatchRateForCustomer(batchId, customerId, { unit });
      if (!(rate > 0)) continue;

      const priced = parcels
        .map(pkg => ({ pkg, ...parcelShippingCharge(pkg, isSea, rate, divisor) }))
        .filter(p => p.amount > 0);
      if (priced.length === 0) continue;

      const customer = await getCustomerById(customerId);
      if (!customer) continue;

      const total = Math.round(priced.reduce((s, p) => s + p.amount, 0) * 100) / 100;
      const unitLabel = isSea ? "m³" : "kg";
      const invoice = await createInvoice({
        invoiceNumber: `INV-${Date.now()}-${customerId}`,
        customerId,
        batchId,
        subtotalUsd: total.toFixed(2),
        totalUsd: total.toFixed(2),
        status: "issued",
        issuedAt: new Date(),
        lineItems: priced.map(p =>
          parcelInvoiceLine(p.pkg.trackingNumber || p.pkg.packageCode, isSea, rate, p.quantity, p.amount)),
        notes: [
          `پسووڵەی باچ ${batch.batchCode}`,
          `نووسراوە لە کاتی دانانی نرخی گواستنەوە`,
          `ژمارەی پاکەت: ${priced.length}`,
          `نرخی ${unitLabel}: $${rate.toFixed(2)}`,
          `کۆی گشتی: $${total.toFixed(2)}`,
        ].join("\n"),
        createdById: actorId,
      });

      for (const p of priced) {
        await recordPackageChargeWithoutInvoice(
          customerId,
          customer.customerCode,
          p.pkg.id,
          p.amount,
          `پاکەت ${p.pkg.trackingNumber || p.pkg.packageCode} - باچ ${batch.batchCode}`,
          actorId,
          invoice.id,
        );
        await updatePackage(p.pkg.id, { isCharged: true });
        try {
          await createRevenueRecord({
            recordDate: new Date(),
            revenueType: "package_delivery",
            referenceType: "package",
            referenceId: p.pkg.id,
            customerId,
            amountUsd: p.amount,
            description: `Package shipping (charged on pricing) - ${p.pkg.packageCode}`,
            createdById: actorId,
          });
        } catch (e) {
          appLogger.error("[ChargeOnPricing] revenue record failed", {
            packageId: p.pkg.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        charged += 1;
      }
      customersBilled += 1;
    } catch (e) {
      appLogger.error("[ChargeOnPricing] failed for customer", {
        batchId,
        customerId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (charged > 0) {
    appLogger.info("[ChargeOnPricing] charged", { batchId, parcels: charged, customers: customersBilled });
  }
  return { eligible: true, parcels: charged, customers: customersBilled };
}

/** For guards and callers that only need the question, not the action. */
export { batchChargesOnPricing };
