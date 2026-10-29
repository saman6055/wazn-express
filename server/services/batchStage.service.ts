import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../db/connection";
import { updateBatch } from "../db/batches.db";
import { batches, countries, deliveryBoxes, deliveryBoxItems, packageScans, packages } from "../../drizzle/schema";
import { batchHasShipmentNumber } from "@shared/parcelStage";
import { batchMadeInChina, nextStoredStatus } from "@shared/batchStage";
import { notifyBatchStatusChange } from "./notification.service";
import { appLogger } from "../utils/logger";

/**
 * Moves a batch forward from the facts — the waybill, the twin, the scans,
 * the Erbil registration — so nobody has to (shared/batchStage, owner
 * 2026-10-28). Called the moment one of those facts is written, and swept
 * every half hour for any path that writes one without calling it.
 *
 * Forward only, and never onto a delivered or closed batch.
 */

async function chinaCountryIds(): Promise<Set<number>> {
  const db = await getDb();
  if (!db) return new Set();
  return new Set((await db.select({ id: countries.id }).from(countries).where(eq(countries.isoCode, "CN"))).map((r) => Number(r.id)));
}

/**
 * One batch. `announce` tells the customers it left, the way the old
 * dropdown did; the sweep passes false so a batch fixed after the fact does
 * not send a "your goods left" days late.
 */
export async function syncBatchStage(
  batchId: number,
  opts: { changedById?: number | null; announce?: boolean; chinaIds?: Set<number> } = {},
): Promise<{ moved: boolean; from?: string; to?: string }> {
  const db = await getDb();
  if (!db) return { moved: false };
  const [b] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  if (!b) return { moved: false };

  const chinaIds = opts.chinaIds ?? (await chinaCountryIds());
  const [[pkgs], [scans], [twin]] = await Promise.all([
    db.select({ n: count() }).from(packages).where(eq(packages.batchId, batchId)),
    db.select({ n: count() }).from(packageScans)
      .innerJoin(packages, eq(packages.id, packageScans.packageId))
      .where(and(eq(packages.batchId, batchId), eq(packageScans.scanType, "received_local"))),
    db.select({ id: batches.id }).from(batches).where(eq(batches.twinOfBatchId, batchId)).limit(1),
  ]);

  const to = nextStoredStatus({
    status: b.status,
    madeInChina: batchMadeInChina(b.createdInCountryId, chinaIds),
    hasShipmentNumber: batchHasShipmentNumber(b),
    hasTwin: Boolean(twin),
    packageCount: Number(pkgs?.n ?? 0),
    arrivalScans: Number(scans?.n ?? 0),
  });
  if (!to) return { moved: false, from: b.status };

  await updateBatch(batchId, { status: to as never }, opts.changedById ?? null);
  appLogger.info("[BatchStage] moved by the facts", { batchId, from: b.status, to });

  if (to === "in_transit") {
    // Only parcels still at the start of the road; a parcel already further
    // along (boxed, delivered) is never dragged back by its batch.
    await db.update(packages).set({ status: "in_transit" })
      .where(and(eq(packages.batchId, batchId), inArray(packages.status, ["registered", "in_batch"])));
    if (opts.announce) {
      try {
        await notifyBatchStatusChange(batchId, "batch_departed");
      } catch (e) {
        appLogger.error("[BatchStage] departure notification failed", { batchId, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return { moved: true, from: b.status, to };
}

/** Best-effort: a stage that cannot move must never fail the save that triggered it. */
export async function syncBatchStageQuietly(batchId: number | null | undefined, changedById?: number | null): Promise<void> {
  if (!batchId) return;
  try {
    await syncBatchStage(batchId, { changedById, announce: true });
  } catch (e) {
    appLogger.error("[BatchStage] sync failed", { batchId, error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Only a parcel that really arrived is arrived (owner, 2026-10-28, on
 * AIR-2026-069: «تەنها ئەو تراکانە بە گەیشتوو حیساب بکە کە پشکنینی
 * گەیشتنی بۆ کراوە»).
 *
 * Moving a batch to the depot by hand used to stamp every parcel in it
 * `customs_processing`, scanned or not, so the portal told the owners of
 * parcels still on a later flight that theirs were here. In a batch at the
 * depot, that stamp is settled per parcel: an arrival scan, or a place in a
 * box (some were handed out without a scan), is arrived; the rest are still
 * on the road. Idempotent; touches nothing else.
 */
export async function settleArrivalStamps(): Promise<{ arrived: number; onRoad: number }> {
  const db = await getDb();
  if (!db) return { arrived: 0, onRoad: 0 };
  const atDepot = (await db.select({ id: batches.id }).from(batches)
    .where(or(eq(batches.status, "at_depot"), eq(batches.status, "arrived")))).map((r) => r.id);
  if (atDepot.length === 0) return { arrived: 0, onRoad: 0 };
  const scanned = db.select({ id: packageScans.packageId }).from(packageScans).where(eq(packageScans.scanType, "received_local"));
  const boxed = db.select({ id: deliveryBoxItems.packageId }).from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, deliveryBoxItems.boxId))
    .where(sql`${deliveryBoxes.status} <> 'cancelled'`);
  const stamped = and(inArray(packages.batchId, atDepot), eq(packages.status, "customs_processing"));
  const a = await db.update(packages).set({ status: "ready_for_delivery" })
    .where(and(stamped, or(inArray(packages.id, scanned), inArray(packages.id, boxed))));
  const r = await db.update(packages).set({ status: "in_transit" }).where(stamped);
  const n = (x: unknown) => Number((x as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
  return { arrived: n(a), onRoad: n(r) };
}

/** Every batch still on the road to Erbil. Silent. */
export async function sweepBatchStages(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const open = await db.select({ id: batches.id }).from(batches)
    .where(or(eq(batches.status, "preparing"), eq(batches.status, "in_transit"), eq(batches.status, "arrived"), eq(batches.status, "customs")));
  const chinaIds = await chinaCountryIds();
  let moved = 0;
  for (const { id } of open) {
    try {
      if ((await syncBatchStage(id, { announce: false, chinaIds })).moved) moved += 1;
    } catch (e) {
      appLogger.error("[BatchStage] sweep failed on a batch", { batchId: id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return moved;
}

const EVERY_MS = 30 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;

export async function startBatchStageSweep(): Promise<void> {
  const run = async () => {
    const moved = await sweepBatchStages();
    if (moved > 0) appLogger.info("[BatchStage] sweep moved batches", { moved });
    const settled = await settleArrivalStamps();
    if (settled.arrived + settled.onRoad > 0) appLogger.info("[BatchStage] arrival stamps settled per parcel", settled);
  };
  // The timer first: a first pass that throws must not leave no timer behind.
  if (!timer) {
    timer = setInterval(() => {
      void run().catch((e) => appLogger.error("[BatchStage] sweep failed", { error: e instanceof Error ? e.message : String(e) }));
    }, EVERY_MS);
  }
  await run();
}
