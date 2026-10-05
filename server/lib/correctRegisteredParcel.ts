import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { resolveParcelCost } from "../services/parcelPricing.service";
import { undoCreditRefusal } from "./creditGuard";
import { mayApproveCredit } from "@shared/creditGuard";
import { withFix } from "@shared/fixAdvice";
import { isAirShipping, DEFAULT_VOLUMETRIC_DIVISOR } from "@shared/chargeableWeight";
import { assessVolumetric } from "@shared/volumetricAlert";
import {
  correctionNote, correctionWords, measuresChanged, moneyFactsChanged, ownerChanged, plainNumber,
  storedMeasure, storedVolumeCbm, typedCbmOf, type CorrectionMoney, type CorrectionWords,
} from "@shared/parcelCorrection";
import { appLogger } from "../utils/logger";

/**
 * The last registration, put right from Quick Register (owner, 2026-10-05).
 *
 * The rule is in shared/parcelCorrection.ts and the money is moved in
 * server/db/parcelCorrection.db.ts. This is the order they are done in:
 *
 *  1. it must be the caller's own last registration — every other parcel is
 *     corrected from the parcel list;
 *  2. the corrected facts are read the way registration reads them;
 *  3. the price is asked for again only if a fact behind it moved;
 *  4. the row and the account are changed together, or not at all;
 *  5. an uncharged parcel is offered to its batch, exactly as registration
 *     offers it.
 */

export interface CorrectionActor {
  id: number;
  name?: string | null;
  role?: string | null;
}

export interface CorrectionInput {
  id: number;
  customerId?: number | null;
  isUnclaimed?: boolean;
  weightKg?: string;
  lengthCm?: string;
  widthCm?: string;
  heightCm?: string;
  /** The volume typed in, as on the register screen. Empty lets the sides decide. */
  volumeCbm?: string;
  description?: string;
  categoryId?: number | null;
  /** Sent only when the photographs changed. */
  photos?: string[];
  approveCredit?: boolean;
}

/** What Quick Register needs to put the last registration back into its form. */
export interface LastRegistrationView {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerCode: string | null;
  customerName: string | null;
  isUnclaimed: boolean;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  /** What belongs in the CBM box: empty when the sides produced the volume. */
  typedCbm: string;
  description: string;
  categoryId: number | null;
  photos: string[];
  batchId: number | null;
  shippingType: string;
  originWarehouseId: number;
  registeredAt: Date | string | null;
  priceUsd: number | null;
  isCharged: boolean;
  /** Its owner follows an order and cannot be changed here. */
  orderLinked: boolean;
  orderCodes: string[];
  /** Why it cannot be corrected here, with the cure — or null. */
  blocked: string | null;
}

export async function lastRegistrationView(userId: number): Promise<LastRegistrationView | null> {
  const pkg = await db.getLastParcelRegisteredBy(userId);
  if (!pkg) return null;

  const customer = pkg.customerId ? await db.getCustomerById(pkg.customerId) : null;
  const orders = await db.ordersBehindParcel(pkg);
  const name = pkg.trackingNumber || pkg.packageCode || String(pkg.id);
  const price = parseFloat(String(pkg.calculatedCostUsd ?? ""));

  return {
    id: pkg.id,
    packageCode: pkg.packageCode,
    trackingNumber: pkg.trackingNumber ?? null,
    customerId: pkg.customerId ?? null,
    customerCode: customer?.customerCode ?? null,
    customerName: customer?.fullName ?? null,
    isUnclaimed: Boolean(pkg.isUnclaimed),
    weightKg: plainNumber(pkg.weightKg, 3),
    lengthCm: plainNumber(pkg.lengthCm, 2),
    widthCm: plainNumber(pkg.widthCm, 2),
    heightCm: plainNumber(pkg.heightCm, 2),
    typedCbm: typedCbmOf(pkg),
    description: pkg.description ?? "",
    categoryId: pkg.categoryId ?? null,
    photos: await db.getPackagePhotos(pkg.id),
    batchId: pkg.batchId ?? null,
    shippingType: pkg.shippingType,
    originWarehouseId: pkg.originWarehouseId,
    registeredAt: pkg.registeredAt ?? null,
    priceUsd: Number.isFinite(price) && price > 0 ? price : null,
    isCharged: Boolean(pkg.isCharged),
    orderLinked: orders.length > 0,
    orderCodes: orders.map((o) => o.orderCode),
    blocked: await db.parcelCorrectionRefusal(pkg.id, name),
  };
}

export interface CorrectionReply {
  packageId: number;
  packageCode: string;
  trackingNumber: string | null;
  money: CorrectionMoney;
  wasUsd: number;
  nowUsd: number;
  chargedUsd: number;
  priceUsd: number | null;
  words: CorrectionWords;
}

const refuse = (code: "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST", cause: string, steps: string[]): TRPCError =>
  new TRPCError({ code, message: withFix(cause, steps) });

export async function correctLastRegistration(actor: CorrectionActor, input: CorrectionInput): Promise<CorrectionReply> {
  const pkg = await db.getPackageById(input.id);
  if (!pkg) {
    throw refuse("NOT_FOUND", "ئەم پاکەتە نەدۆزرایەوە — لەوانەیە سڕدرابێتەوە.", [
      "لاپەڕەکە نوێ بکەرەوە",
      "لە «هەموو پاکەتەکان» بە تراکەکەی بگەڕێ",
    ]);
  }
  const name = pkg.trackingNumber || pkg.packageCode || String(pkg.id);

  // 1. Only the caller's own last registration.
  const last = await db.getLastParcelRegisteredBy(actor.id);
  if (!last || last.id !== pkg.id) {
    throw refuse(
      "CONFLICT",
      `پاکەتی ${name} ئیتر دوایین تۆماری تۆ نییە — لێرە تەنها دوایین تۆمار چاک دەکرێتەوە.`,
      [
        "لە «هەموو پاکەتەکان» بە تراکەکەی بگەڕێ و لەوێ دەستکاری بکە",
        "ئەگەر دەتەوێت دوایین تۆمارت چاک بکەیتەوە، دوگمەی «چاککردنەوە» ی سەر بانەری «دوایین تۆمار» دووبارە لێبدە",
      ],
    );
  }

  // 2. The corrected facts, read the way registration reads them.
  const orders = await db.ordersBehindParcel(pkg);
  const orderLinked = orders.length > 0;

  let customerId: number | null;
  let isUnclaimed: boolean;
  if (orderLinked) {
    // The parcel belongs to its order's customer by contract.
    customerId = pkg.customerId ?? null;
    isUnclaimed = Boolean(pkg.isUnclaimed);
    const asked = { customerId: input.isUnclaimed ? null : input.customerId ?? null, isUnclaimed: input.isUnclaimed === true };
    if ((input.customerId !== undefined || input.isUnclaimed !== undefined) && ownerChanged(pkg, asked)) {
      throw refuse(
        "CONFLICT",
        `خاوەنی پاکەتی ${name} لێرە ناگۆڕدرێت — ئەم پاکەتە هی ئۆردەری ${orders.map((o) => o.orderCode).join("، ")} ـە و خاوەنەکەی بەدوای ئۆردەرەکەدا دەڕوات.`,
        [
          "ئەگەر ئۆردەرەکە بۆ کڕیارێکی هەڵە تۆمار کراوە، ئۆردەرەکە بکەرەوە و کڕیارەکەی لەوێ بگۆڕە",
          "ئەگەر ئەم تراکە هی ئەو ئۆردەرە نییە، لە ئۆردەرەکە تراکەکە لابدە",
        ],
      );
    }
  } else if (input.isUnclaimed === true) {
    customerId = null;
    isUnclaimed = true;
  } else {
    customerId = input.customerId ?? null;
    isUnclaimed = false;
    if (!customerId) {
      throw refuse("BAD_REQUEST", "خاوەنی پاکەتەکە دیاری نەکراوە.", [
        "لە خانەی کڕیار بە کۆد یان ناو بگەڕێ و لە لیستەکە هەڵیبژێرە",
        "ئەگەر هێشتا نازانیت هی کێیە، «بێ خاوەن» دیاری بکە",
      ]);
    }
  }
  const customer = customerId ? await db.getCustomerById(customerId) : null;
  if (customerId && !customer) {
    throw refuse("NOT_FOUND", "ئەو کڕیارە نەدۆزرایەوە.", [
      "لە خانەی کڕیار بە کۆد یان ناو بگەڕێ و لە لیستەکە هەڵیبژێرە",
      "ئەگەر کڕیارەکە نوێیە، سەرەتا تۆماری بکە",
    ]);
  }

  const measures = {
    weightKg: storedMeasure(input.weightKg),
    lengthCm: storedMeasure(input.lengthCm),
    widthCm: storedMeasure(input.widthCm),
    heightCm: storedMeasure(input.heightCm),
    volumeCbm: storedVolumeCbm(input.volumeCbm, input.lengthCm, input.widthCm, input.heightCm),
  };
  const after = { ...measures, customerId, isUnclaimed };

  // 3. The price is asked for again only if a fact behind it moved.
  const repriced = moneyFactsChanged(pkg, after);

  if (repriced && orderLinked && measuresChanged(pkg, measures)) {
    const charged = orders.filter((o) => o.isShippingCharged);
    if (charged.length > 0) {
      throw refuse(
        "CONFLICT",
        `کێش و قیاسی پاکەتی ${name} لێرە ناگۆڕدرێت — کرێی گواستنەوەی ئۆردەری ${charged.map((o) => o.orderCode).join("، ")} پێشتر بە ژمارە کۆنەکان خراوەتە سەر حیسابی کڕیار، و گۆڕینی لێرە حیسابەکە ناجووڵێنێت.`,
        [
          "ئۆردەرەکە بکەرەوە و کرێی گواستنەوەکەی لەوێ ڕاست بکەرەوە، بە هۆکارەوە",
          "ئینجا کێش و قیاسی پاکەتەکە لە «هەموو پاکەتەکان» ڕاست بکەرەوە",
        ],
      );
    }
  }

  if (repriced) {
    // A parcel in a box, or paid on a receipt, is corrected where its money is.
    const blocked = await db.parcelCorrectionRefusal(pkg.id, name);
    if (blocked) throw new TRPCError({ code: "CONFLICT", message: blocked });
  }

  let calculatedCostUsd = pkg.calculatedCostUsd ?? null;
  let appliedPricingRuleId = pkg.appliedPricingRuleId ?? null;
  if (repriced) {
    if (isUnclaimed) {
      // Registration stores no price for a parcel nobody owns.
      calculatedCostUsd = null;
      appliedPricingRuleId = null;
    } else {
      const priced = await resolveParcelCost({
        customerId,
        batchId: pkg.batchId,
        originWarehouseId: pkg.originWarehouseId,
        shippingType: pkg.shippingType,
        ...measures,
      });
      calculatedCostUsd = priced.costUsd ?? null;
      appliedPricingRuleId = priced.pricingRuleId ?? null;
    }
  }

  const facts = {
    ...after,
    description: (input.description ?? "").trim() || null,
    categoryId: input.categoryId ?? null,
    photos: input.photos === undefined ? undefined : input.photos,
    calculatedCostUsd,
    appliedPricingRuleId,
  };

  const before = pkg.customerId ? await db.getCustomerById(pkg.customerId) : null;
  const reason = correctionNote(name, pkg, measures, {
    before: before?.customerCode ?? null,
    after: customer?.customerCode ?? null,
  });

  // 4. The row and the account, together or not at all.
  let moved: Awaited<ReturnType<typeof db.applyParcelCorrection>>;
  try {
    moved = repriced
      ? await db.applyParcelCorrection(pkg.id, actor.id, facts, reason, {
          allowCredit: mayApproveCredit(actor.role) && input.approveCredit === true,
        })
      : await db.applyParcelDetails(pkg.id, facts);
  } catch (err) {
    const credit = undoCreditRefusal(err, actor.role);
    if (credit) throw credit;
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({ code: "CONFLICT", message: err instanceof Error ? err.message : String(err) });
  }

  // 5. Uncharged now, and something is due: offered to its batch, as a
  //    registration is. The same call, with the same safety — a failure here
  //    leaves the parcel uncharged and logged, and the next parcel registered
  //    into the batch charges it.
  let chargedUsd = 0;
  if (moved.chargeAfter && pkg.batchId) {
    try {
      const due = await db.shippingChargeDueNow({ ...pkg, ...after });
      await db.chargeBatchShippingIfDue(pkg.batchId, actor.id);
      const now = await db.getPackageById(pkg.id);
      if (now?.isCharged) chargedUsd = due.amount;
    } catch (err) {
      appLogger.error("[ParcelCorrection] charge after correction failed", {
        packageId: pkg.id, batchId: pkg.batchId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Billed on its size now, by a margin worth telling the customer about —
  // raised as a registration raises it, and never allowed to undo the save.
  if (measuresChanged(pkg, measures) && isAirShipping(pkg.shippingType)) {
    try {
      const divisorSetting = await db.getSetting("cbm_divisor");
      const divisor = parseInt(divisorSetting ?? "", 10) || DEFAULT_VOLUMETRIC_DIVISOR;
      const thresholds = await db.getVolumetricThresholds();
      const assessment = assessVolumetric(
        { shippingType: pkg.shippingType, ...measures },
        { divisor, thresholds },
      );
      if (assessment.alert) {
        await db.raiseVolumetricAlert({
          packageId: pkg.id,
          packageCode: pkg.packageCode,
          trackingNumber: pkg.trackingNumber ?? null,
          customerId,
          assessment,
          dims: { lengthCm: measures.lengthCm, widthCm: measures.widthCm, heightCm: measures.heightCm },
          actorId: actor.id,
          actorName: actor.name ?? `#${actor.id}`,
        });
      }
    } catch (err) {
      appLogger.error("[ParcelCorrection] volumetric alert failed", {
        packageId: pkg.id, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await db.createAuditLog({
    userId: actor.id,
    userRole: actor.role ?? "staff",
    action: "correct_package",
    entityType: "package",
    entityId: pkg.id,
    oldValues: {
      customerId: pkg.customerId, isUnclaimed: pkg.isUnclaimed,
      weightKg: pkg.weightKg, lengthCm: pkg.lengthCm, widthCm: pkg.widthCm, heightCm: pkg.heightCm,
      volumeCbm: pkg.volumeCbm, calculatedCostUsd: pkg.calculatedCostUsd,
      description: pkg.description, categoryId: pkg.categoryId,
    },
    newValues: {
      ...after, calculatedCostUsd, description: facts.description, categoryId: facts.categoryId,
      photosChanged: input.photos !== undefined,
      money: moved.money, wasUsd: moved.wasUsd, nowUsd: moved.nowUsd, chargedUsd,
    },
  });

  const price = parseFloat(String(calculatedCostUsd ?? ""));
  const priceUsd = Number.isFinite(price) && price > 0 ? price : null;
  const outcome = { money: moved.money, wasUsd: moved.wasUsd, nowUsd: moved.nowUsd, chargedUsd, priceUsd };
  return {
    packageId: pkg.id,
    packageCode: pkg.packageCode,
    trackingNumber: pkg.trackingNumber ?? null,
    ...outcome,
    words: correctionWords(outcome),
  };
}
