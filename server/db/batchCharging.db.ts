import { and, eq } from "drizzle-orm";
import { getDb } from "./connection";
import { packages } from "../../drizzle/schema";
import { getBatchById, getBatchRateForCustomer } from "./batches.db";
import { getCustomerById } from "./customers.db";
import { updatePackage } from "./packages.db";
import { recordPackageChargeWithoutInvoice, createRevenueRecord } from "./finance.db";
import { createInvoice } from "./invoices.db";
import { getVolumetricDivisor } from "./settings.db";
import { selfOrderConditions } from "./selfOrder.filter";
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
        .map(pkg => {
          const quantity = isSea
            ? Number(pkg.volumeCbm ?? 0) || 0
            : chargeableWeight(pkg, divisor).chargeableKg;
          const amount = Math.round(quantity * rate * 100) / 100;
          return { pkg, quantity, amount };
        })
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
        lineItems: priced.map(p => ({
          description: `پاکەت ${p.pkg.trackingNumber || p.pkg.packageCode}\nنرخ: ${p.quantity.toFixed(isSea ? 3 : 2)} ${unitLabel} × $${rate.toFixed(2)}/${unitLabel} = $${p.amount.toFixed(2)}`,
          quantity: 1,
          unitPrice: p.amount,
          total: p.amount,
        })),
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
