import * as db from "../db";
import { billingUnit } from "@shared/batchRate";
import { parcelCost, type ParcelCostInput } from "@shared/parcelCost";
import { smallParcelBreakdown } from "@shared/parcelCost";
import { agreedUsd } from "@shared/agreedShipping";
import { smallParcelRuleFor } from "../db/smallParcel.db";
import { DEFAULT_VOLUMETRIC_DIVISOR } from "@shared/chargeableWeight";

/**
 * What one parcel costs, from whatever the system currently knows.
 *
 * The arithmetic is in `@shared/parcelCost`; the looking-up is here, because
 * three answers were being given to the same question depending on which
 * screen asked it:
 *
 *   registration     the general route rule, and only that
 *   approving a claim  the batch's rate, and only that
 *   delivery         the batch's rate, falling back to the route rule
 *   editing a parcel   nothing at all — the price simply stayed as it was
 *
 * The last is what the owner reported: a weight corrected, and $0.00 sitting
 * there afterwards as though nothing had been typed.
 *
 * The order below is delivery's, because delivery is the one that takes the
 * money. The rate agreed for this shipment, then the route rule as a fallback
 * — so the figure staff and the customer see before delivery points at the
 * invoice they will actually get, instead of away from it.
 */

export type ParcelCostSource = "batch" | "route_rule" | "none";

export interface ParcelPricingFacts {
  customerId?: number | null;
  batchId?: number | null;
  originWarehouseId?: number | null;
  shippingType?: string | null;
  weightKg?: string | number | null;
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  volumeCbm?: string | number | null;
  /** A volumetric discount: the kilos charged (shared/chargeableWeight). */
  billedWeightKg?: string | number | null;
  /** An existing parcel being repriced: its stored waiver is read from it. */
  packageId?: number | null;
  /** The office took the small-parcel extra off this parcel; undefined reads the stored flag. */
  smallParcelWaived?: boolean | null;
  /** «نرخی ڕێککەوتوو» for this parcel; undefined reads the stored one when packageId is given. */
  agreedShippingUsd?: string | number | null;
}

export interface ResolvedParcelCost {
  /** 0 when no rate is known. Callers must not write it over a real price. */
  amountUsd: number;
  /** The stored string, or undefined meaning "leave what is there alone". */
  costUsd: string | undefined;
  rate: number;
  unit: "kg" | "cbm";
  source: ParcelCostSource;
  /** Set only when the route rule decided it, for the audit column. */
  pricingRuleId?: number;
  billedOnVolume: boolean;
  /** The small-parcel percent added to this price (whole number), else 0. */
  smallParcelPercent?: number;
  /** The $5 minimum set this price. */
  smallParcelMinimum?: boolean;
  /** The parcel is under the line in a batch with the rule on: the waiver box is offered. */
  smallParcelEligible?: boolean;
  /** Eligible, and the extra was taken off. */
  smallParcelWaived?: boolean;
  /** The plain price before the extra, for the office's "base → final". */
  smallParcelBaseUsd?: number;
  /** An agreed price set the amount: what the system itself would have charged. */
  computedUsd?: number;
  agreedUsd?: number | null;
}

/** The install's air divisor, or IATA's. Read once per call, not per parcel. */
async function volumetricDivisor(): Promise<number> {
  const setting = await db.getSetting("cbm_divisor");
  return parseInt(setting ?? "", 10) || DEFAULT_VOLUMETRIC_DIVISOR;
}

/**
 * The parcel's price: the computed one, with an agreed amount on top when the
 * parcel carries one («نرخی ڕێککەوتوو», shared/agreedShipping) - it overrides
 * the rate, the least and the small-parcel extra.
 */
export async function resolveParcelCost(
  facts: ParcelPricingFacts,
): Promise<ResolvedParcelCost> {
  const computed = await resolveComputedParcelCost(facts);
  let agreed = facts.agreedShippingUsd;
  if (agreed === undefined && facts.packageId) {
    const pkg = await db.getPackageById(facts.packageId);
    agreed = (pkg as { agreedShippingUsd?: string | null } | undefined)?.agreedShippingUsd ?? null;
  }
  const a = agreedUsd(agreed);
  if (a === null) return { ...computed, computedUsd: computed.amountUsd, agreedUsd: null };
  return {
    ...computed,
    amountUsd: a,
    costUsd: a.toFixed(2),
    source: computed.source === "none" ? "batch" : computed.source,
    computedUsd: computed.amountUsd,
    agreedUsd: a,
  };
}

async function resolveComputedParcelCost(
  facts: ParcelPricingFacts,
): Promise<ResolvedParcelCost> {
  const unit = billingUnit(facts.shippingType);
  const divisor = await volumetricDivisor();

  const measure: ParcelCostInput = {
    rate: 0,
    unit,
    weightKg: facts.weightKg,
    lengthCm: facts.lengthCm,
    widthCm: facts.widthCm,
    heightCm: facts.heightCm,
    volumeCbm: facts.volumeCbm,
    billedWeightKg: facts.billedWeightKg,
    divisor,
  };

  const answer = (rate: number, source: ParcelCostSource, pricingRuleId?: number): ResolvedParcelCost => {
    const { amountUsd, billedOnVolume } = parcelCost({ ...measure, rate });
    return {
      amountUsd,
      costUsd: amountUsd > 0 ? amountUsd.toFixed(2) : undefined,
      rate,
      unit,
      source: amountUsd > 0 ? source : "none",
      pricingRuleId,
      billedOnVolume,
    };
  };

  // 1. The shipment's rate for this customer — their agreed rate, their tier,
  //    or the shipment's own. This is the one the invoice will use.
  if (facts.batchId && facts.customerId) {
    const batch = await db.getBatchById(facts.batchId);
    if (batch) {
      // A parcel travels in the unit its shipment sells in, not the unit its
      // own type implies: a carton in a sea batch is sold by volume.
      const batchUnit = billingUnit(batch.shippingType);
      const resolved = await db.getBatchRateForCustomer(facts.batchId, facts.customerId, { unit: batchUnit });
      if (resolved.rate > 0) {
        // A small sea parcel pays the rule's extra (shared/parcelCost),
        // measured by itself, unless the office took it off.
        const smallParcel = batchUnit === "cbm"
          ? await smallParcelRuleFor(batch, facts.customerId, { id: facts.packageId, volumeCbm: measure.volumeCbm, ...(facts.smallParcelWaived !== undefined ? { smallParcelWaived: facts.smallParcelWaived } : {}) })
          : null;
        const { amountUsd, billedOnVolume } = parcelCost({ ...measure, unit: batchUnit, rate: resolved.rate, smallParcel });
        const plainUsd = batchUnit === "cbm" ? parcelCost({ ...measure, unit: batchUnit, rate: resolved.rate }).amountUsd : amountUsd;
        const sp = smallParcelBreakdown(plainUsd, smallParcel);
        const smallParcelPercent = sp.eligible && !sp.waived ? sp.percent : 0;
        const smallParcelMinimum = sp.minimum;
        if (amountUsd > 0) {
          return {
            amountUsd,
            costUsd: amountUsd.toFixed(2),
            rate: resolved.rate,
            unit: batchUnit,
            source: "batch",
            billedOnVolume,
            smallParcelPercent,
            smallParcelMinimum,
            smallParcelEligible: sp.eligible,
            smallParcelWaived: sp.waived,
            smallParcelBaseUsd: sp.baseUsd,
          };
        }
      }
    }
  }

  // 2. The general route rule: origin country, destination, shipping type.
  //    What registration has always used, kept as the fallback so a parcel
  //    that is not in a batch yet still gets an estimate.
  if (facts.originWarehouseId && facts.shippingType) {
    const warehouse = await db.getWarehouseById(facts.originWarehouseId);
    const destCountries = await db.getDestinationCountries();
    const destCountry = destCountries[0];
    if (warehouse && destCountry) {
      const rule = await db.getApplicablePricingRule(
        warehouse.countryId,
        destCountry.id,
        facts.shippingType as "air_regular" | "air_irregular" | "sea",
      );
      if (rule) {
        // The rule states its own unit, and it need not agree with the
        // shipping type — a sea rule priced per kg would otherwise be
        // multiplied by a volume.
        const ruleUnit = rule.unit === "cbm" ? "cbm" : "kg";
        const rate = parseFloat(rule.pricePerUnit);
        const { amountUsd, billedOnVolume } = parcelCost({ ...measure, unit: ruleUnit, rate });
        if (amountUsd > 0) {
          return {
            amountUsd,
            costUsd: amountUsd.toFixed(2),
            rate,
            unit: ruleUnit,
            source: "route_rule",
            pricingRuleId: rule.id,
            billedOnVolume,
          };
        }
      }
    }
  }

  return answer(0, "none");
}
