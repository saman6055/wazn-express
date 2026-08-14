/**
 * Which stages a parcel's journey actually has, and how far along it is.
 *
 * The timeline listed "registered" and "at China warehouse" as two steps. For
 * a parcel quick-registered at the China depot those are one event:
 * registering it IS its arrival, which is why the notification sent for that
 * very scan already reads "Arrived at China warehouse". The timeline
 * disagreed with the message, and left every parcel apparently stuck one step
 * short of a warehouse it was already sitting in.
 *
 * There are two registration points now. Goods that never reach China are
 * registered in Erbil and shipped from there within a couple of days, and for
 * those the China stage is not merely un-reached — it is never coming, so
 * showing it as pending promises something that will not happen.
 *
 * An unrecorded location means China: everything registered before the
 * location stamp existed went through that depot, which is what the system
 * was built around. The Erbil route came later.
 */

export const JOURNEY_STAGES = [
  "registered",
  "received_china",
  "in_batch",
  "in_transit",
  "received_local",
  "out_for_delivery",
  "delivered",
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export interface JourneyContext {
  /**
   * Whether the parcel was registered at an origin depot rather than at the
   * destination. Undefined or null for anything registered before the
   * location was recorded, which means China.
   */
  registeredAtOrigin?: boolean | null;
}

/** Was this parcel handled at the China depot at all? */
export function passesThroughOrigin(context: JourneyContext): boolean {
  return context.registeredAtOrigin !== false;
}

/**
 * The stages this parcel's journey really has.
 *
 * A parcel registered in Erbil skips the China warehouse — it was never
 * there, and a step that can never complete is worse than no step at all.
 */
export function stagesFor(context: JourneyContext): JourneyStage[] {
  if (passesThroughOrigin(context)) return [...JOURNEY_STAGES];
  return JOURNEY_STAGES.filter((stage) => stage !== "received_china");
}

/**
 * The stage a status has actually reached.
 *
 * `registered` reaches the China warehouse when that is where it happened,
 * because the two are the same event. Registered in Erbil, the parcel is
 * simply registered — and the China stage is not in its journey at all.
 */
export function stageReachedBy(
  stage: JourneyStage,
  context: JourneyContext
): JourneyStage {
  if (stage === "registered" && passesThroughOrigin(context)) return "received_china";
  return stage;
}

/**
 * How far along the parcel is, as an index into `stagesFor`.
 *
 * Returns -1 when the status is not part of the journey. A returned or
 * cancelled parcel is not on this road, and handing the caller a 0 would show
 * it sitting cheerfully at step one.
 */
export function progressIndex(
  currentStage: string,
  context: JourneyContext
): number {
  if (!JOURNEY_STAGES.includes(currentStage as JourneyStage)) return -1;
  const reached = stageReachedBy(currentStage as JourneyStage, context);
  return stagesFor(context).indexOf(reached);
}
