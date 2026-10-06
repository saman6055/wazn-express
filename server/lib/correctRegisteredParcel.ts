import { TRPCError } from "@trpc/server";
import * as db from "../db";
import type { Package } from "../../drizzle/schema";
import { resolveParcelCost } from "../services/parcelPricing.service";
import { undoCreditRefusal } from "./creditGuard";
import { mayApproveCredit } from "@shared/creditGuard";
import { withFix } from "@shared/fixAdvice";
import { isAirShipping, DEFAULT_VOLUMETRIC_DIVISOR } from "@shared/chargeableWeight";
import { assessVolumetric } from "@shared/volumetricAlert";
import {
  correctionNote, correctionWords, editHoldWords, measuresChanged, moneyFactsChanged, ownerChanged, plainNumber,
  storedMeasure, storedVolumeCbm, typedCbmOf,
  type CorrectionMoney, type CorrectionWords, type ParcelMoneyHold,
} from "@shared/parcelCorrection";
import type { RepriceReport } from "@shared/parcelReprice";
import { appLogger } from "../utils/logger";

/**
 * A registered parcel put right, and its money with it (owner, 2026-10-05).
 *
 * Two doors, one rule. Quick Register corrects the caller's own last
 * registration without leaving the screen; the parcel list corrects any
 * parcel. Both end in the same place - server/db/parcelCorrection.db.ts -
 * where the parcel's one line on the account is made to read the right
 * figure. The parts with no database in them are in shared/parcelCorrection.ts.
 *
 * The order things are done in:
 *
 *  1. the door's own gate - Quick Register: it must be the caller's last
 *     registration; the parcel list: the parcel must be on an account at all;
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

/** The facts a parcel's price rests on, as a door hands them over. */
interface PricedFacts {
  customerId: number | null;
  isUnclaimed: boolean;
  weightKg: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  volumeCbm: string | null;
}

/** The rest of the row a correction writes: nothing here is behind the price. */
interface ParcelDetails {
  description: string | null;
  categoryId: number | null;
  /** Undefined leaves the photographs as they are. */
  photos?: string[];
}

interface MoneyMoved {
  moved: Awaited<ReturnType<typeof db.applyParcelCorrection>>;
  calculatedCostUsd: string | null;
  chargedUsd: number;
}

const positive = (v: unknown): number | null => {
  const x = parseFloat(String(v ?? ""));
  return Number.isFinite(x) && x > 0 ? x : null;
};

/**
 * The money, the same way for both doors (steps 3 to 5 above).
 *
 * The stored price is asked for again, the row and the account are changed
 * together or not at all, and a parcel left uncharged is offered to its
 * batch. A lowering that would leave a credit comes back as the main admin's
 * question - or, for everybody else, as a refusal that says the cure.
 * Anything else the ledger refuses is thrown on as it is, for the door to
 * say in its own way.
 */
async function moveParcelMoney(
  actor: CorrectionActor,
  pkg: Package,
  name: string,
  after: PricedFacts,
  details: ParcelDetails,
  approveCredit: boolean | undefined,
): Promise<MoneyMoved> {
  // 3. Registration stores no price for a parcel nobody owns.
  let calculatedCostUsd: string | null = null;
  let appliedPricingRuleId: number | null = null;
  if (!after.isUnclaimed) {
    const priced = await resolveParcelCost({
      customerId: after.customerId,
      batchId: pkg.batchId,
      originWarehouseId: pkg.originWarehouseId,
      shippingType: pkg.shippingType,
      weightKg: after.weightKg,
      lengthCm: after.lengthCm,
      widthCm: after.widthCm,
      heightCm: after.heightCm,
      volumeCbm: after.volumeCbm,
    });
    calculatedCostUsd = priced.costUsd ?? null;
    appliedPricingRuleId = priced.pricingRuleId ?? null;
  }

  const facts = { ...after, ...details, calculatedCostUsd, appliedPricingRuleId };

  const ownerBefore = pkg.customerId ? await db.getCustomerById(pkg.customerId) : null;
  const ownerAfter = after.customerId ? await db.getCustomerById(after.customerId) : null;
  const reason = correctionNote(name, pkg, after, {
    before: ownerBefore?.customerCode ?? null,
    after: ownerAfter?.customerCode ?? null,
  });

  // 4. The row and the account, together or not at all.
  let moved: MoneyMoved["moved"];
  try {
    moved = await db.applyParcelCorrection(pkg.id, actor.id, facts, reason, {
      allowCredit: mayApproveCredit(actor.role) && approveCredit === true,
      actorRole: actor.role ?? null,
    });
  } catch (err) {
    const credit = undoCreditRefusal(err, actor.role);
    if (credit) throw credit;
    throw err;
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

  return { moved, calculatedCostUsd, chargedUsd };
}

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
  const after: PricedFacts = { ...measures, customerId, isUnclaimed };

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

  const details: ParcelDetails = {
    description: (input.description ?? "").trim() || null,
    categoryId: input.categoryId ?? null,
    photos: input.photos === undefined ? undefined : input.photos,
  };

  // 3 to 5. A photograph or a description alone never reads the account.
  let done: MoneyMoved;
  try {
    done = repriced
      ? await moveParcelMoney(actor, pkg, name, after, details, input.approveCredit)
      : { moved: await db.applyParcelDetails(pkg.id, details), calculatedCostUsd: pkg.calculatedCostUsd ?? null, chargedUsd: 0 };
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({ code: "CONFLICT", message: err instanceof Error ? err.message : String(err) });
  }
  const { moved, calculatedCostUsd, chargedUsd } = done;

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
      ...after, calculatedCostUsd, description: details.description, categoryId: details.categoryId,
      photosChanged: input.photos !== undefined,
      money: moved.money, wasUsd: moved.wasUsd, nowUsd: moved.nowUsd, chargedUsd,
    },
  });

  const outcome = { money: moved.money, wasUsd: moved.wasUsd, nowUsd: moved.nowUsd, chargedUsd, priceUsd: positive(calculatedCostUsd) };
  return {
    packageId: pkg.id,
    packageCode: pkg.packageCode,
    trackingNumber: pkg.trackingNumber ?? null,
    ...outcome,
    words: correctionWords(outcome),
  };
}

/** What the parcel list's edit sends that bears on a charged parcel's money. */
export interface ChargedParcelEdit {
  customerId?: number | null;
  weightKg?: string | null;
  lengthCm?: string | null;
  widthCm?: string | null;
  heightCm?: string | null;
  volumeCbm?: string | null;
  /** Undefined when the edit does not mention the batch; null takes the parcel out of it. */
  batchId?: number | null;
  description?: string | null;
  categoryId?: number | null;
  approveCredit?: boolean;
}

/** A charged parcel saved with nothing behind its price changed: nothing to say. */
const QUIET: RepriceReport = { outcome: "untouched", wasUsd: null, nowUsd: null };

const held = (hold: ParcelMoneyHold): RepriceReport =>
  ({ outcome: "held", wasUsd: null, nowUsd: null, said: editHoldWords(hold) });

/**
 * The parcel list's edit, for a parcel that is already on its owner's account.
 *
 * Owner, 2026-10-05, told that this edit changed a charged parcel's weight
 * and left its debt where it was: «ئەوەش بە هەمان شێوە ئەپدەیت ببێتەوە، بەبێ
 * ڕیکۆردی نرخ و کێشی کۆن». So a weight or a size corrected here moves the
 * parcel's debt with it, by the function Quick Register's correction uses.
 *
 * Returns null for a parcel with no charge to follow - never charged, or
 * nobody's - which the edit reprices the way it always has. Otherwise it
 * returns what happened to the account, in the report the screen already
 * shows:
 *
 *  - nothing behind the price moved: nothing, and nothing is said. The dialog
 *    sends every field on every save, so "sent" is not "changed" - the
 *    figures are compared with the row;
 *  - the money is no longer the parcel's to move - paid on a receipt, sitting
 *    in a delivery box, an order's carton, or moved to another batch by the
 *    same edit: the edit is saved as it always was, the account is left
 *    alone, and the sentence says where the price is put right instead;
 *  - otherwise the row and the account are corrected together.
 *
 * A lowering that would leave a credit is refused whole - nothing is saved -
 * and the main admin is asked, exactly as in Quick Register.
 */
export async function correctChargedParcelOnEdit(
  actor: CorrectionActor,
  pkg: Package,
  edit: ChargedParcelEdit,
): Promise<RepriceReport | null> {
  if (!pkg.isCharged || pkg.isUnclaimed) return null;

  const after: PricedFacts = {
    customerId: edit.customerId ?? pkg.customerId ?? null,
    isUnclaimed: false,
    weightKg: edit.weightKg ?? pkg.weightKg ?? null,
    lengthCm: edit.lengthCm ?? pkg.lengthCm ?? null,
    widthCm: edit.widthCm ?? pkg.widthCm ?? null,
    heightCm: edit.heightCm ?? pkg.heightCm ?? null,
    volumeCbm: edit.volumeCbm ?? pkg.volumeCbm ?? null,
  };
  const batchMoved = edit.batchId !== undefined && (edit.batchId ?? null) !== (pkg.batchId ?? null);
  if (!batchMoved && !moneyFactsChanged(pkg, after)) return QUIET;

  if (batchMoved) return held({ kind: "batch" });
  const orders = await db.ordersBehindParcel(pkg);
  if (orders.length > 0) return held({ kind: "order", orderCodes: orders.map((o) => o.orderCode) });
  const hold = await db.parcelMoneyHold(pkg.id);
  if (hold) return held(hold);

  const name = pkg.trackingNumber || pkg.packageCode || String(pkg.id);
  let done: MoneyMoved;
  try {
    done = await moveParcelMoney(actor, pkg, name, after, {
      description: edit.description !== undefined ? edit.description : pkg.description ?? null,
      categoryId: edit.categoryId !== undefined ? edit.categoryId : pkg.categoryId ?? null,
    }, edit.approveCredit);
  } catch (err) {
    // The credit question, or its refusal: nothing was saved.
    if (err instanceof TRPCError) throw err;
    // The account is not as it should be: the edit is still saved, and the
    // person is told what stands in the way.
    if (err instanceof db.ParcelAccountError) return held({ kind: "account", said: err.message });
    throw new TRPCError({ code: "CONFLICT", message: err instanceof Error ? err.message : String(err) });
  }

  const { moved, calculatedCostUsd, chargedUsd } = done;
  const outcome = { money: moved.money, wasUsd: moved.wasUsd, nowUsd: moved.nowUsd, chargedUsd, priceUsd: positive(calculatedCostUsd) };
  return {
    outcome: "account",
    wasUsd: moved.wasUsd > 0 ? moved.wasUsd : null,
    nowUsd: moved.nowUsd > 0 ? moved.nowUsd : chargedUsd > 0 ? chargedUsd : null,
    said: correctionWords(outcome),
  };
}
