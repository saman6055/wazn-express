import * as db from "../db";
import { resolveParcelCost } from "../services/parcelPricing.service";
import { declaredLinkRefusal, type DeclaredLinkRefusal } from "@shared/declaredLink";

/**
 * Give a customer's declared tracking its parcel, from the Portal Center
 * (owner, 2026-09-18, phase 2). When it may is shared/declaredLink.ts.
 *
 * The owner's answer: it does what approving an ownership claim does, no
 * more. Approving a claim gives the parcel its owner (approveClaimRequest in
 * server/db/portal.db.ts) and then its price (the approveClaimRequest route in
 * server/routers/packages.router.ts); the charge follows the rules it always
 * has. So do these two steps, in that order, from the same resolver.
 */
export async function linkDeclaredParcel(
  declarationId: number,
  staffId: number,
): Promise<
  | { ok: true; packageId: number; packageCode: string; customerId: number }
  | { ok: false; reason: DeclaredLinkRefusal | "not_found" }
> {
  const declared = await db.getDeclaredPackageById(declarationId);
  if (!declared) return { ok: false, reason: "not_found" };

  // Its own matched parcel if registration found one, else the parcel with its tracking.
  const parcel = declared.matchedPackageId
    ? await db.getPackageById(declared.matchedPackageId)
    : await db.getPackageByTrackingNumber(declared.trackingNumber.trim());
  const refusal = declaredLinkRefusal(declared, parcel ?? null);
  if (refusal) return { ok: false, reason: refusal };

  // 1. The owner — refused in the same statement if someone was quicker.
  const given = await db.linkUnownedPackageToCustomer(parcel!.id, declared.customerId!, staffId);
  if (!given) return { ok: false, reason: "owned" };

  // 2. The price, as approving a claim sets it.
  await priceClaimedParcel(parcel!.id);

  // 3. The declaration is fulfilled, by this parcel.
  await db.markDeclarationLinked(declarationId, parcel!.id);

  return { ok: true, packageId: parcel!.id, packageCode: parcel!.packageCode, customerId: declared.customerId! };
}

/**
 * A parcel that has just been given its owner gets its price — the step the
 * approveClaimRequest route runs after a claim is approved, from the same
 * resolver, with the same inputs. The charge is not written here.
 */
export async function priceClaimedParcel(packageId: number): Promise<void> {
  const pkg = await db.getPackageById(packageId);
  if (!pkg || pkg.isCharged) return;
  const priced = await resolveParcelCost({
    customerId: pkg.customerId,
    batchId: pkg.batchId,
    originWarehouseId: pkg.originWarehouseId,
    shippingType: pkg.shippingType,
    weightKg: pkg.weightKg,
    lengthCm: pkg.lengthCm,
    widthCm: pkg.widthCm,
    heightCm: pkg.heightCm,
    volumeCbm: pkg.volumeCbm,
  });
  if (priced.costUsd) {
    await db.updatePackage(packageId, {
      calculatedCostUsd: priced.costUsd,
      ...(priced.pricingRuleId ? { appliedPricingRuleId: priced.pricingRuleId } : {}),
    });
  }
}
