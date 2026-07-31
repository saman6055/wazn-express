/**
 * Grouping the six batch statuses into the three stages a customer recognises.
 *
 * The database tracks preparing → in_transit → arrived → customs → delivered →
 * closed. A customer does not think in six steps; they want to know whether
 * their goods are still in China, on the way, or in their hands.
 *
 * The old grouping put "arrived" and "customs" — goods already in Iraq — in the
 * same bucket as "preparing". That was wrong, and only went unnoticed because
 * the bucket was vaguely labelled "preparing". Naming it "in the China
 * warehouse" made the error impossible to miss.
 */

export type BatchStatus =
  | "preparing"
  | "in_transit"
  | "arrived"
  | "customs"
  | "delivered"
  | "closed";

/** "" is no filter — what the removed "All" chip used to mean. */
export type ShipmentStage = "" | "in_china" | "in_transit" | "delivered";

const STAGE_OF: Record<BatchStatus, Exclude<ShipmentStage, "">> = {
  preparing: "in_china",
  // In Iraq, but not yet handed over — from the customer's side, still coming.
  in_transit: "in_transit",
  arrived: "in_transit",
  customs: "in_transit",
  delivered: "delivered",
  closed: "delivered",
};

/** Which of the three stages a raw status belongs to. */
export function stageOf(status: string): Exclude<ShipmentStage, ""> | null {
  return STAGE_OF[status as BatchStatus] ?? null;
}

/** Does this batch belong under the chosen stage? No stage means everything. */
export function matchesStage(status: string, stage: ShipmentStage): boolean {
  if (!stage) return true;
  return stageOf(status) === stage;
}

/** How many batches sit in each stage, for the filter counts. */
export function countByStage(statuses: string[]): Record<Exclude<ShipmentStage, "">, number> {
  const counts = { in_china: 0, in_transit: 0, delivered: 0 };
  for (const status of statuses) {
    const stage = stageOf(status);
    if (stage) counts[stage] += 1;
  }
  return counts;
}
