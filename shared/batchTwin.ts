import { twinBatchCode } from "./carrierGroup";

/**
 * An Erbil twin beside the China batch it was made from (owner, 2026-10-29).
 *
 * The owner mixed AIR-2026-072GZ and its twin up: the two names looked
 * alike, both could be renamed, and in the list they sat apart. So:
 *
 *   - the twin is listed straight after its original;
 *   - the twin's name is not its own - it is always the original's code with
 *     " Erbil" after it, and follows when the original is renamed;
 *   - a desk registers only into batches made where it is: China into China
 *     batches, Erbil into Erbil batches (owner, 2026-10-29, looking at Quick
 *     Register in Erbil offering 078GZ and 075GZ: «لە تۆماری خێرا گرنگ نیە
 *     باچی چین نیشان بدات»; China batches are for the arrival check).
 */

/** Each twin moved to sit straight after its original, when both are in the list. */
export function twinsBesideOriginal<T extends { id: number; twinOfBatchId?: number | null }>(rows: readonly T[]): T[] {
  const ids = new Set(rows.map((r) => r.id));
  const twinsOf = new Map<number, T[]>();
  for (const r of rows) {
    if (r.twinOfBatchId != null && ids.has(r.twinOfBatchId)) {
      twinsOf.set(r.twinOfBatchId, [...(twinsOf.get(r.twinOfBatchId) ?? []), r]);
    }
  }
  const out: T[] = [];
  for (const r of rows) {
    if (r.twinOfBatchId != null && ids.has(r.twinOfBatchId)) continue;
    out.push(r, ...(twinsOf.get(r.id) ?? []));
  }
  return out;
}

/** The name a twin must carry, from its original's code. */
export function twinCodeFor(originalCode: string): string {
  return twinBatchCode(originalCode);
}

/**
 * May this person register into this batch, by where each is? Only into a
 * batch made where the desk is. Unknown on either side (a desk with no place
 * set, an old batch) answers yes.
 */
export function batchMatchesDesk(batchMadeInChina: boolean | null | undefined, deskInChina: boolean | null | undefined): boolean {
  if (batchMadeInChina == null || deskInChina == null) return true;
  return batchMadeInChina === deskInChina;
}

/**
 * The batches the arrival check offers: made in China (an Erbil batch never
 * travelled), and not yet finished - including one already in the Erbil
 * depot, whose later parcels are still being checked in (AIR-2026-069 and
 * -072 on 2026-10-29: half checked in, the rest on Saturday).
 */
export function batchOpenForArrivalCheck(b: { status: string | null | undefined; madeInChina?: boolean | null }): boolean {
  if (b.madeInChina === false) return false;
  return ["preparing", "in_transit", "customs", "arrived", "at_depot"].includes(String(b.status ?? ""));
}
