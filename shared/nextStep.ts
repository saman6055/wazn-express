/**
 * What happens next to a customer's goods, and roughly when.
 *
 * A portal that says "in transit: 3" has answered a question nobody asked.
 * The one a customer opens the app for is the next thing that will happen to
 * their own things — the shipment closest to reaching them, what it is
 * waiting on, and when that is expected.
 *
 * The status ladder already carries all of it. What was missing was reading
 * it forwards instead of backwards: every screen described where a shipment
 * has been, and none of them said where it goes next.
 *
 * Deliberately vague where the data is vague. A date the system does not
 * actually know is worse than no date: it becomes a promise, and a customer
 * holds you to it. So an estimate is returned only when one was recorded,
 * and it is always marked as an estimate.
 */

export type NextStepKey =
  | "leaving_china"
  | "arriving_iraq"
  | "clearing_customs"
  | "reaching_depot"
  | "ready_to_collect"
  | "done";

export interface ShipmentForNextStep {
  status?: string | null;
  /** When the batch is expected to reach Iraq, if anybody recorded it. */
  estimatedArrival?: Date | string | null;
  /** Recorded arrival, which beats an estimate once it exists. */
  actualArrival?: Date | string | null;
}

export interface NextStep {
  key: NextStepKey;
  /** Null when nothing was recorded. Never invented. */
  expectedAt: Date | null;
  /** True once the expected date is behind us and the step still has not happened. */
  overdue: boolean;
  /** Nothing is pending: the goods are with the customer. */
  finished: boolean;
}

const NEXT_OF: Record<string, NextStepKey> = {
  preparing: "leaving_china",
  in_transit: "arriving_iraq",
  arrived: "clearing_customs",
  customs: "reaching_depot",
  at_depot: "ready_to_collect",
  delivered: "done",
  closed: "done",
};

const asDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** What this one shipment is waiting on. */
export function nextStepOf(
  shipment: ShipmentForNextStep,
  now: Date = new Date(),
): NextStep {
  const key = NEXT_OF[String(shipment.status ?? "")] ?? "leaving_china";
  const finished = key === "done";

  // Only the leg that ends at Iraq has a recorded expectation. Customs and
  // the drive to the depot take what they take, and inventing a number for
  // them would be inventing a promise.
  const expectedAt =
    !finished && key === "arriving_iraq"
      ? asDate(shipment.actualArrival) ?? asDate(shipment.estimatedArrival)
      : null;

  return {
    key,
    expectedAt,
    overdue: expectedAt !== null && expectedAt.getTime() < now.getTime(),
    finished,
  };
}

/**
 * Of everything a customer has moving, the one worth putting on the screen.
 *
 * The furthest along that has not arrived — which is the next one to reach
 * them. A shipment still in China is true but not news; the one clearing
 * customs today is what they want to know about.
 */
const CLOSENESS: Record<NextStepKey, number> = {
  ready_to_collect: 5,
  reaching_depot: 4,
  clearing_customs: 3,
  arriving_iraq: 2,
  leaving_china: 1,
  done: 0,
};

export function mostRelevantShipment<T extends ShipmentForNextStep>(
  shipments: readonly T[],
  now: Date = new Date(),
): { shipment: T; step: NextStep } | null {
  let best: { shipment: T; step: NextStep } | null = null;
  for (const shipment of shipments) {
    const step = nextStepOf(shipment, now);
    if (step.finished) continue;
    if (!best) { best = { shipment, step }; continue; }
    const a = CLOSENESS[step.key];
    const b = CLOSENESS[best.step.key];
    if (a > b) { best = { shipment, step }; continue; }
    // Same stage: the one with a date, and the sooner of two dates. A
    // shipment nobody dated is not more urgent than one that is late.
    if (a === b) {
      const mine = step.expectedAt?.getTime();
      const theirs = best.step.expectedAt?.getTime();
      if (mine !== undefined && (theirs === undefined || mine < theirs)) {
        best = { shipment, step };
      }
    }
  }
  return best;
}
