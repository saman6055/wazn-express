import { chargeableWeight, DEFAULT_VOLUMETRIC_DIVISOR } from "./chargeableWeight";

/**
 * What to know before a batch is closed or marked delivered.
 *
 * Owner, 2026-09-18, on the pre-delivery check: before a batch is closed, say
 * how many cartons still have no box and how many were never checked in on
 * arrival, list them with their code and tracking — a click shows the carton
 * with its photos — and whatever else matters at that moment: a batch with no
 * selling price, a batch at a loss.
 *
 * Every one of these is a warning, never a stop (the owner's answer): only a
 * customer mismatch holds a batch back, as before. A loss is a warning too.
 * The same check runs before "delivered" as before "closed".
 *
 * Pure: the server gathers the facts (server/db/batchCloseCheck.db.ts), this
 * says what they mean, the dialog shows them.
 */

/** A carton the check names — what the dialog lists and the carton sheet opens. */
export interface CloseCheckParcel {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerCode: string | null;
  customerName: string | null;
  customerMobile: string | null;
  shippingType: string | null;
  weightKg: string | null;
  volumeCbm: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  registeredAt: Date | string | null;
  batchId: number;
  /** The carton's first photograph, for the row. */
  photo: string | null;
  orderNumbers: string[];
}

/** A box holding this batch's cartons that still owes money. */
export interface CloseCheckBox {
  boxId: number;
  boxCode: string;
  status: string;
  customerCode: string | null;
  customerName: string | null;
  outstandingUsd: number;
}

/** The batch's money, as its profit and loss report reads it. */
export interface CloseCheckMoney {
  /** No selling price for the way it travels, and no tiers or per-customer prices either. */
  priceMissing: boolean;
  /** No shipping cost recorded: profit and loss cannot be told. */
  costMissing: boolean;
  revenueUsd: number;
  costUsd: number;
  profitUsd: number | null;
}

/**
 * The lists a check sheet can be made of.
 *
 * Named here because the screen asks for one by name and the server reads
 * the same name off the facts — a typo on either side would quietly print
 * an empty sheet (owner, 2026-09-26).
 */
export const CHECK_SHEET_SECTIONS = ["unboxed", "notArrivalChecked", "unmeasured", "ownerless"] as const;
export type CheckSheetSection = (typeof CHECK_SHEET_SECTIONS)[number];

/** Returned or cancelled: nothing left to box, check in or charge. */
export const ENDED_PARCEL_STATUSES = ["returned", "cancelled"] as const;

export function parcelEnded(status: string | null | undefined): boolean {
  return (ENDED_PARCEL_STATUSES as readonly string[]).includes(String(status ?? ""));
}

/**
 * Should this carton have been checked in on arrival? Not one that has ended,
 * and not one already handed over — that one certainly arrived, scanned in or
 * not.
 */
export function needsArrivalCheck(status: string | null | undefined): boolean {
  return !parcelEnded(status) && status !== "delivered";
}

/**
 * No measure to bill it by: an air carton by its chargeable weight (the
 * larger of the scale and its size), a sea carton by its volume.
 */
export function lacksBillingMeasure(
  parcel: {
    shippingType?: string | null;
    weightKg?: string | number | null;
    volumeCbm?: string | number | null;
    lengthCm?: string | number | null;
    widthCm?: string | number | null;
    heightCm?: string | number | null;
  },
  divisor: number = DEFAULT_VOLUMETRIC_DIVISOR,
): boolean {
  if (parcel.shippingType === "sea") return !(Number(parcel.volumeCbm) > 0);
  return !(chargeableWeight(parcel, divisor).chargeableKg > 0);
}

/** At a loss — said only when the cost is known; a missing cost is its own warning. */
export function batchAtLoss(money: CloseCheckMoney | null | undefined): boolean {
  if (!money || money.costMissing || money.profitUsd == null) return false;
  return money.profitUsd < -0.005;
}

/** Anything here worth a second look before the batch moves on. */
export function closeCheckWarns(facts: {
  unboxed: readonly unknown[];
  notArrivalChecked: readonly unknown[];
  unmeasured: readonly unknown[];
  ownerless: readonly unknown[];
  unpaidBoxes: readonly unknown[];
  missingNumber: readonly unknown[];
  money: CloseCheckMoney | null;
}): boolean {
  return (
    facts.unboxed.length > 0 ||
    facts.notArrivalChecked.length > 0 ||
    facts.unmeasured.length > 0 ||
    facts.ownerless.length > 0 ||
    facts.unpaidBoxes.length > 0 ||
    facts.missingNumber.length > 0 ||
    !!facts.money?.priceMissing ||
    !!facts.money?.costMissing ||
    batchAtLoss(facts.money)
  );
}
