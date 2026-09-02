import * as db from "../db";
import { billingUnit } from "@shared/batchRate";
import { parcelCost, type ParcelCostInput } from "@shared/parcelCost";
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
}

/** The install's air divisor, or IATA's. Read once per call, not per parcel. */
async function volumetricDivisor(): Promise<number> {
  const setting = await db.getSetting("cbm_divisor");
  return parseInt(setting ?? "", 10) || DEFAULT_VOLUMETRIC_DIVISOR;
}

export async function resolveParcelCost(
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
        const { amountUsd, billedOnVolume } = parcelCost({ ...measure, unit: batchUnit, rate: resolved.rate });
        if (amountUsd > 0) {
          return {
            amountUsd,
            costUsd: amountUsd.toFixed(2),
            rate: resolved.rate,
            unit: batchUnit,
            source: "batch",
            billedOnVolume,
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
