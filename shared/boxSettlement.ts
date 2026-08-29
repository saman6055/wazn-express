/**
 * What a box costs, and what is left to pay on it.
 *
 * The box is the last thing that happens before goods leave the building and
 * the only door money comes back through, so every number on that screen has
 * to be derivable from something already recorded — never typed twice and
 * never held in a column of its own that can drift from the ledger.
 *
 * This is the arithmetic, kept away from the database so it can be read on
 * its own and tested exhaustively. One rule per parcel:
 *
 *     outstanding = charged − discounted − settled
 *
 * and everything the counter can do is one of the four terms moving.
 *
 * Shared because the screen adds it up to show the operator, the server adds
 * it up again to decide what to write, and the receipt adds it up a third
 * time. Three sums of the same money must be one function.
 */

/** How a discount is classified, for the report that has to add them up. */
export const DISCOUNT_REASONS = ["damaged", "late", "goodwill", "loyal", "rounding", "other"] as const;
export type DiscountReason = (typeof DISCOUNT_REASONS)[number];

export interface ParcelMoney {
  packageId: number;
  /** Chargeable kilos, for a discount expressed as a lower rate per kilo. */
  weightKg?: number;
  /** Ledger debits net of any correction already applied. The price. */
  chargedUsd: number;
  /** Forgiven on earlier settlements. */
  discountedUsd: number;
  /** Paid on earlier settlements. */
  settledUsd: number;
}

/** What the operator has decided to do with one parcel, on this settlement. */
export interface ParcelIntent {
  packageId: number;
  /** Set aside: not on this receipt, still owed. */
  held?: boolean;
  /** Signed change to the price itself, because the price was wrong. */
  correctionUsd?: number;
  /** Forgiven now. */
  discountUsd?: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Money already owed on a parcel, before anything the counter does today. */
export function outstandingOf(parcel: ParcelMoney): number {
  return round2(parcel.chargedUsd - parcel.discountedUsd - parcel.settledUsd);
}

export interface SettlementLineResult {
  packageId: number;
  chargedUsd: number;
  correctionUsd: number;
  discountUsd: number;
  /** What this settlement pays toward this parcel. Zero when held. */
  paidUsd: number;
  held: boolean;
  /** Still owed after this settlement. */
  remainingUsd: number;
}

export interface SettlementTotals {
  lines: SettlementLineResult[];
  /** The parcels' price, before anything is taken off. */
  chargedUsd: number;
  /** Signed: negative when we had overcharged, positive when we undercharged. */
  correctionUsd: number;
  discountUsd: number;
  /** Owed on parcels deliberately left off this receipt. */
  heldUsd: number;
  /** What the customer should hand over. */
  dueUsd: number;
}

/**
 * Add up one settlement from the parcels and what the operator did to them.
 *
 * A held parcel contributes nothing to `dueUsd` and keeps its whole
 * outstanding balance — that is the answer to "one parcel's money was not
 * paid, how do we receipt the others".
 *
 * A correction moves the price, not the payment: a parcel overcharged by
 * $1.25 is corrected down and then costs $1.25 less, which is a different
 * fact from forgiving $1.25 and must not land in the discount report.
 */
export function settlementTotals(
  parcels: ParcelMoney[],
  intents: ParcelIntent[] = [],
): SettlementTotals {
  const byId = new Map(intents.map((i) => [i.packageId, i]));

  const lines = parcels.map((parcel): SettlementLineResult => {
    const intent = byId.get(parcel.packageId);
    const correctionUsd = round2(intent?.correctionUsd ?? 0);
    const held = intent?.held === true;
    // A held parcel is not being argued about today; forgiving money on a
    // parcel nobody is paying for would be a discount against nothing.
    const discountUsd = held ? 0 : round2(Math.max(0, intent?.discountUsd ?? 0));

    const owed = round2(outstandingOf(parcel) + correctionUsd);
    // Never negative: a correction bigger than the balance means the parcel
    // is square, not that the customer is owed money on this line. Any real
    // overpayment is settled once, at the box, as credit.
    const payable = round2(Math.max(0, owed - discountUsd));
    const paidUsd = held ? 0 : payable;

    return {
      packageId: parcel.packageId,
      chargedUsd: round2(parcel.chargedUsd),
      correctionUsd,
      discountUsd,
      paidUsd,
      held,
      remainingUsd: held ? round2(Math.max(0, owed)) : round2(Math.max(0, owed - discountUsd - paidUsd)),
    };
  });

  const sum = (pick: (l: SettlementLineResult) => number) =>
    round2(lines.reduce((total, line) => total + pick(line), 0));

  return {
    lines,
    chargedUsd: sum((l) => l.chargedUsd),
    correctionUsd: sum((l) => l.correctionUsd),
    discountUsd: sum((l) => l.discountUsd),
    heldUsd: sum((l) => (l.held ? l.remainingUsd : 0)),
    dueUsd: sum((l) => l.paidUsd),
  };
}

/**
 * A discount on the whole box, which is how one is usually given.
 *
 * Nobody at a counter forgives $4.13 on parcel three. They say the box is
 * nine hundred, call it eight-eighty — or they say the kilo is eleven
 * dollars, make it ten. Both are one decision about the box, and asking for
 * it parcel by parcel would be asking the wrong question five times.
 *
 * It still has to land on the parcels underneath, because that is what the
 * discount report reads and what decides when a parcel stops being owed. So
 * the box figure is split across them in proportion to what each costs, and
 * the last cent goes to the largest line rather than being lost to rounding.
 */
export type BoxDiscountMode = "none" | "amount" | "newTotal" | "perKg";

export interface BoxDiscount {
  mode: BoxDiscountMode;
  /** mode "amount": money off. mode "newTotal": what the box becomes. */
  value?: number;
  /** mode "perKg": the old rate and the new one, e.g. 11 → 10. */
  fromRatePerKg?: number;
  toRatePerKg?: number;
}

/**
 * Turn whichever way it was expressed into one number of dollars.
 *
 * Never negative and never more than the box: "make it eight-eighty" on a
 * box that is only eight hundred is a typo, and charging a negative is not
 * what anybody meant by it.
 */
export function boxDiscountUsd(discount: BoxDiscount, parcels: ParcelMoney[]): number {
  const total = round2(parcels.reduce((sum, p) => sum + outstandingOf(p), 0));
  const clamp = (n: number) => round2(Math.min(Math.max(0, n), total));

  switch (discount.mode) {
    case "amount":
      return clamp(discount.value ?? 0);
    case "newTotal":
      return clamp(total - (discount.value ?? total));
    case "perKg": {
      const from = discount.fromRatePerKg ?? 0;
      const to = discount.toRatePerKg ?? 0;
      // A rate that went up is not a discount; it is a price change, and it
      // belongs in a correction where it will be asked for a reason.
      if (!(from > 0) || !(to >= 0) || to >= from) return 0;
      const kg = parcels.reduce((sum, p) => sum + (p.weightKg ?? 0), 0);
      return clamp(kg * (from - to));
    }
    default:
      return 0;
  }
}

/**
 * Split a box-level discount across the parcels it applies to.
 *
 * Proportional to what each parcel still owes, so a parcel carrying half the
 * box carries half the discount. Held parcels are skipped — they are not on
 * this receipt, so nothing is being forgiven on them.
 *
 * The remainder from rounding goes to the largest share, which keeps the
 * parts adding up to exactly the whole. A cent that goes missing here is a
 * cent that leaves a parcel owing forever.
 */
export function allocateBoxDiscount(
  amountUsd: number,
  parcels: ParcelMoney[],
  heldPackageIds: number[] = [],
): Map<number, number> {
  const held = new Set(heldPackageIds);
  const eligible = parcels.filter((p) => !held.has(p.packageId) && outstandingOf(p) > 0);
  const out = new Map<number, number>();
  if (!(amountUsd > 0) || eligible.length === 0) return out;

  const total = round2(eligible.reduce((sum, p) => sum + outstandingOf(p), 0));
  if (!(total > 0)) return out;
  const capped = round2(Math.min(amountUsd, total));

  let assigned = 0;
  for (const parcel of eligible) {
    const share = round2((outstandingOf(parcel) / total) * capped);
    out.set(parcel.packageId, share);
    assigned = round2(assigned + share);
  }

  const remainder = round2(capped - assigned);
  if (remainder !== 0) {
    const biggest = eligible.reduce((a, b) => (outstandingOf(b) > outstandingOf(a) ? b : a));
    out.set(biggest.packageId, round2((out.get(biggest.packageId) ?? 0) + remainder));
  }
  return out;
}

export type DifferenceKind = "none" | "debt" | "discount" | "credit";

export interface Difference {
  kind: DifferenceKind;
  /** Always positive. `kind` says which direction. */
  amountUsd: number;
  /** Whether the operator has to say why before this can be saved. */
  reasonRequired: boolean;
}

/**
 * What to do about the gap between what was due and what was handed over.
 *
 * On the ordinary day there is no gap: a box is $900, $900 comes back, and
 * nothing below fires — no reason, no extra field, one press. Everything
 * here exists for the days that are not that one.
 *
 * Short is either a debt the customer still owes or a discount we chose to
 * give, and only a person can say which — so the caller passes `treatShortAs`
 * and a reason is required either way. Over is credit, which needs no
 * decision: it sits on their balance and comes off the next box.
 */
export function differenceOf(
  dueUsd: number,
  paidUsd: number,
  treatShortAs: "debt" | "discount" = "debt",
): Difference {
  const delta = round2(paidUsd - dueUsd);
  if (delta === 0) return { kind: "none", amountUsd: 0, reasonRequired: false };
  if (delta > 0) return { kind: "credit", amountUsd: delta, reasonRequired: false };
  return { kind: treatShortAs, amountUsd: round2(-delta), reasonRequired: true };
}

/**
 * Dinars into dollars.
 *
 * The charge is in dollars and the money arrives in dinars, so one of the two
 * has to be converted and the rate that did it has to be kept — "we took
 * 1,305,000" means nothing a month later without knowing what a dollar cost
 * that day.
 */
export function iqdToUsd(amountIqd: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return round2(amountIqd / rate);
}

export function usdToIqd(amountUsd: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(amountUsd * rate);
}

/**
 * Whether a box has been paid for, from a list row.
 *
 * A row that showed the amount taken read "Paid $190" on a box worth $200 —
 * true about the money and wrong about the box, on the two screens where
 * somebody checks whether a customer still owes. Part-paid is not paid, and
 * it is the state most worth seeing.
 *
 * Shared because the office list and the customer's own list must never
 * disagree about it: the customer reading "paid" while the counter reads
 * "owes" is an argument nobody can win.
 */
export type BoxPaidState = "paid" | "partly" | "unpaid";

export function boxPaidState(
  settledUsd: number | null | undefined,
  totalValueUsd: string | number | null | undefined,
): BoxPaidState {
  const paid = Number(settledUsd ?? 0);
  if (!(paid > 0)) return "unpaid";
  const worth = Number(totalValueUsd ?? 0);
  // A box with no recorded worth but money taken against it counts as paid:
  // the money is the better evidence of what happened.
  if (!(worth > 0)) return "paid";
  // Half a cent of slack, so a rounded dinar payment does not leave a box
  // looking part-paid forever.
  return paid + 0.005 >= worth ? "paid" : "partly";
}
