/**
 * One carrier shipment, several of our batches (owner, 2026-10-28) - see
 * shared/carrierGroup for the rules. This gathers the group, keeps its one
 * invoice, shares it out onto each batch (through updateBatch, so the price
 * history records it and every cost rule reads the batch as before) and
 * makes the Erbil twin of a China batch.
 */
import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { batchCarrierParts, batches, carrierGroupInvoices, countries, packageScans, packages, users } from "../../drizzle/schema";
import { chargeableWeight } from "@shared/chargeableWeight";
import { parcelHasArrived } from "@shared/dispatchStage";
import { groupDifferenceUsd, groupVerdict, normalizeCarrierBatchNo, splitGroupInvoice, twinBatchCode } from "@shared/carrierGroup";
import { isBatchEditLocked, mayEditLockedBatch } from "@shared/batchPriceHistory";
import { batchMadeInChina } from "@shared/batchStage";
import { batchMatchesDesk, twinCodeFor } from "@shared/batchTwin";
import { withFix } from "@shared/fixAdvice";
import { getVolumetricDivisor } from "./settings.db";
import { createBatch, getBatchById, updateBatch } from "./batches.db";

async function need() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

async function chinaIds(): Promise<Set<number>> {
  const db = await need();
  return new Set((await db.select({ id: countries.id }).from(countries).where(eq(countries.isoCode, "CN"))).map((r) => Number(r.id)));
}

/** The batches of this one's group: same carrier batch number, and its twin either way. */
async function memberIds(batch: { id: number; carrierBatchNo: string | null; twinOfBatchId: number | null }): Promise<number[]> {
  const db = await need();
  const key = normalizeCarrierBatchNo(batch.carrierBatchNo);
  const conds = [eq(batches.twinOfBatchId, batch.id)];
  if (key) conds.push(eq(batches.carrierBatchNo, key));
  if (batch.twinOfBatchId) conds.push(eq(batches.id, batch.twinOfBatchId));
  const rows = await db.select({ id: batches.id }).from(batches).where(or(...conds));
  return Array.from(new Set([batch.id, ...rows.map((r) => Number(r.id))])).sort((a, b) => a - b);
}

/** The original renamed: every twin of it takes the new name (shared/batchTwin). */
export async function renameTwinsOf(originalId: number, originalCode: string, userId: number): Promise<void> {
  const db = await need();
  const twins = await db.select({ id: batches.id }).from(batches).where(eq(batches.twinOfBatchId, originalId));
  for (const t of twins) await updateBatch(t.id, { batchCode: twinCodeFor(originalCode) } as never, userId);
}

/** Is this member of staff's desk in China? Null when their place is not set. */
export async function deskInChina(userId: number): Promise<boolean | null> {
  const db = await need();
  const [u] = await db.select({ countryId: users.workCountryId }).from(users).where(eq(users.id, userId)).limit(1);
  if (u?.countryId == null) return null;
  return (await chinaIds()).has(Number(u.countryId));
}

/**
 * Refuse a China desk's parcel going into an Erbil batch (owner, 2026-10-29;
 * an Erbil desk may use either). Unknown on either side lets it through.
 */
export async function assertBatchMatchesDesk(batchId: number | null | undefined, userId: number): Promise<void> {
  if (!batchId) return;
  const batch = await getBatchById(batchId);
  if (!batch) return;
  const desk = await deskInChina(userId);
  const made = batchMadeInChina(batch.createdInCountryId, await chinaIds());
  if (batchMatchesDesk(made, desk)) return;
  const twins = made ? await (await need()).select({ code: batches.batchCode }).from(batches).where(eq(batches.twinOfBatchId, batch.id)).limit(1) : [];
  throw new Error(withFix(
    made
      ? `باچی ${batch.batchCode} باچی چینە — پاکێجی هەولێر ناچێتە ناوی.`
      : `باچی ${batch.batchCode} باچی هەولێرە — پاکێجی چین ناچێتە ناوی.`,
    made && twins[0]
      ? [`لە تۆماری خێرا باچی ${twins[0].code} هەڵبژێرە`]
      : ["باچێکی دروستکراو لە هەمان شوێنی خۆت هەڵبژێرە"],
  ));
}

/** Each batch's kilos: all of them, and the part already in Erbil (read only). */
async function memberFacts(ids: number[]) {
  const db = await need();
  const rows = await db.select().from(batches).where(inArray(batches.id, ids));
  const cn = await chinaIds();
  const parcels = await db
    .select({
      id: packages.id, batchId: packages.batchId, status: packages.status,
      weightKg: packages.weightKg, billedWeightKg: packages.billedWeightKg,
      lengthCm: packages.lengthCm, widthCm: packages.widthCm, heightCm: packages.heightCm,
    })
    .from(packages)
    .where(and(inArray(packages.batchId, ids), notInArray(packages.status, ["cancelled", "returned"])));
  const pIds = parcels.map((p) => p.id);
  const scanned = new Set(pIds.length === 0 ? [] : (await db.selectDistinct({ id: packageScans.packageId }).from(packageScans)
    .where(and(inArray(packageScans.packageId, pIds), eq(packageScans.scanType, "received_local")))).map((r) => Number(r.id)));
  const divisor = await getVolumetricDivisor();
  const loads = new Set((await db.select({ batchId: batchCarrierParts.batchId }).from(batchCarrierParts).where(inArray(batchCarrierParts.batchId, ids))).map((r) => Number(r.batchId)));

  const members = rows.map((b) => {
    const china = batchMadeInChina(b.createdInCountryId, cn);
    const mine = parcels.filter((p) => p.batchId === b.id);
    let kg = 0, liveKg = 0, coming = 0;
    for (const p of mine) {
      const w = chargeableWeight(p, divisor).chargeableKg;
      kg += w;
      // A China parcel counts once it is in Erbil; an Erbil one is in Erbil when registered.
      if (!china || parcelHasArrived({ scannedIn: scanned.has(p.id), status: p.status })) liveKg += w;
      else coming += 1;
    }
    return {
      batchId: b.id, batchCode: b.batchCode, status: b.status, shippingType: b.shippingType,
      madeInChina: china, twinOfBatchId: b.twinOfBatchId ?? null, carrierBatchNo: b.carrierBatchNo ?? null,
      parcels: mine.length, kg: r2(kg), liveKg: r2(liveKg), stillComing: coming,
      chargedWeightKg: b.chargedWeightKg, shippingCost: b.shippingCost, hasLoads: loads.has(b.id),
    };
  }).sort((a, b) => Number(b.madeInChina) - Number(a.madeInChina) || a.batchId - b.batchId);
  return members;
}

/** Everything the group card and the scan strip show. Read only. */
export async function getCarrierGroup(batchId: number) {
  const db = await need();
  const batch = await getBatchById(batchId);
  if (!batch) return null;
  const ids = await memberIds(batch as never);
  const key = normalizeCarrierBatchNo(batch.carrierBatchNo);
  if (ids.length < 2 && !key) return null;

  const members = await memberFacts(ids);

  const [invoice] = key ? await db.select().from(carrierGroupInvoices).where(eq(carrierGroupInvoices.carrierBatchNo, key)).limit(1) : [];
  const billedKg = invoice ? Number(invoice.billedKg) : null;
  const costUsd = invoice ? Number(invoice.costUsd) : null;
  const oursKg = r2(members.reduce((s, m) => s + m.liveKg, 0));
  const stillComing = members.reduce((s, m) => s + m.stillComing, 0);
  const shares = invoice ? splitGroupInvoice(members.map((m) => ({ batchId: m.batchId, kg: m.kg })), billedKg!, costUsd!) : [];

  return {
    key,
    members,
    invoice: invoice ? { billedKg: billedKg!, costUsd: costUsd!, note: invoice.note, splitAt: invoice.splitAt } : null,
    oursKg,
    allKg: r2(members.reduce((s, m) => s + m.kg, 0)),
    stillComing,
    verdict: groupVerdict({ billedKg, oursKg, stillComing }),
    differenceUsd: invoice ? groupDifferenceUsd({ billedKg: billedKg!, costUsd: costUsd!, oursKg }) : 0,
    shares,
  };
}

/** The invoice, once, for the group - then shared out onto each batch. */
export async function saveCarrierGroupInvoice(
  input: { batchId: number; billedKg: number; costUsd: number; note?: string | null },
  user: { id: number; role: string },
) {
  const db = await need();
  const batch = await getBatchById(input.batchId);
  if (!batch) throw new Error(withFix("ئەم باچە نەدۆزرایەوە.", ["لاپەڕەکە نوێ بکەرەوە"]));
  const key = normalizeCarrierBatchNo(batch.carrierBatchNo);
  if (!key) {
    throw new Error(withFix("ئەم باچە ژمارەی باچی کۆمپانیای گواستنەوەی لەسەر نییە.", [
      "لە «زانیاری سەرەتایی» ژمارەی باچی کۆمپانیا بنووسە، بۆ نموونە ANC 169",
      "پاشەکەوتی بکە، ئینجا وەسڵەکە بنووسە",
    ]));
  }
  if (!(input.billedKg > 0) || !(input.costUsd >= 0)) throw new Error(withFix("کێش یان پارەی وەسڵ دروست نییە.", ["کێشی وەسڵ بە کیلۆ و پارەکەی بە دۆلار بنووسە"]));
  const [existing] = await db.select({ id: carrierGroupInvoices.id }).from(carrierGroupInvoices).where(eq(carrierGroupInvoices.carrierBatchNo, key)).limit(1);
  const values = { billedKg: input.billedKg.toFixed(2), costUsd: input.costUsd.toFixed(2), note: (input.note ?? "").trim() || null };
  if (existing) await db.update(carrierGroupInvoices).set(values).where(eq(carrierGroupInvoices.id, existing.id));
  else await db.insert(carrierGroupInvoices).values({ carrierBatchNo: key, ...values, createdById: user.id });
  return applyCarrierGroupSplit(input.batchId, user);
}

/**
 * Each batch of the group takes its share of the invoice as its billed weight
 * and its cost. A batch whose carrier came in loads of its own (carrierParts)
 * or a delivered one the user may not edit is left as it is, and said so.
 */
export async function applyCarrierGroupSplit(batchId: number, user: { id: number; role: string }) {
  const db = await need();
  const g = await getCarrierGroup(batchId);
  if (!g || !g.invoice || !g.key) throw new Error(withFix("ئەم گرووپە هێشتا وەسڵی نییە.", ["وەسڵی کۆمپانیا بنووسە"]));
  const applied: string[] = [];
  const skipped: Array<{ batchCode: string; why: string }> = [];
  for (const m of g.members) {
    const share = g.shares.find((s) => s.batchId === m.batchId);
    if (!share) continue;
    if (m.hasLoads) { skipped.push({ batchCode: m.batchCode, why: "loads" }); continue; }
    if (isBatchEditLocked(m.status) && !mayEditLockedBatch(user.role)) { skipped.push({ batchCode: m.batchCode, why: "locked" }); continue; }
    await updateBatch(m.batchId, { chargedWeightKg: share.billedKg.toFixed(2), shippingCost: share.costUsd.toFixed(2) } as never, user.id);
    applied.push(m.batchCode);
  }
  await db.update(carrierGroupInvoices).set({ splitAt: new Date() }).where(eq(carrierGroupInvoices.carrierBatchNo, g.key));
  return { applied, skipped };
}

/**
 * The Erbil twin of a China batch, made by the office from inside it (owner:
 * «ئەبێ من بچم بۆ ناو باچی چین باچی هەولێر دروست بکەم»). Air only. It takes
 * the China batch's journey - type, route, airline, waybill, carrier batch
 * number, dates, status - and none of its money: the selling price is the
 * office's to set.
 */
export async function createTwinBatch(batchId: number, userId: number) {
  const db = await need();
  const china = await getBatchById(batchId);
  if (!china) throw new Error(withFix("ئەم باچە نەدۆزرایەوە.", ["لاپەڕەکە نوێ بکەرەوە"]));
  const cn = await chinaIds();
  if (!(china.createdInCountryId != null && cn.has(Number(china.createdInCountryId)))) {
    throw new Error(withFix(`باچی ${china.batchCode} لە چین دروست نەکراوە — توین تەنها بۆ باچی چینە.`, ["لە ناو باچێکی چینەوە دروستی بکە"]));
  }
  if (china.shippingType === "sea") throw new Error(withFix("توین تەنها بۆ باچی ئاسمانییە.", ["باچی بەحری وەک ئێستا بەکاربهێنە"]));
  if (china.twinOfBatchId) throw new Error(withFix(`${china.batchCode} خۆی توینی باچێکی ترە.`, ["لە باچی چینەکەوە دروستی بکە"]));
  const [already] = await db.select({ code: batches.batchCode }).from(batches).where(eq(batches.twinOfBatchId, china.id)).limit(1);
  if (already) throw new Error(withFix(`ئەم باچە پێشتر توینی هەیە: ${already.code}.`, ["هەمان توین بەکاربهێنە"]));

  return createBatch({
    batchCode: twinBatchCode(china.batchCode),
    originWarehouseId: china.originWarehouseId,
    destinationCountryId: china.destinationCountryId,
    shippingType: china.shippingType,
    airlineName: china.airlineName,
    flightNumber: china.flightNumber,
    shippingCompany: china.shippingCompany,
    awbNumber: china.awbNumber,
    carrierInfo: china.carrierInfo,
    carrierBatchNo: normalizeCarrierBatchNo(china.carrierBatchNo),
    twinOfBatchId: china.id,
    departureDate: china.departureDate,
    estimatedArrival: china.estimatedArrival,
    status: china.status,
    useTieredPricing: china.useTieredPricing,
    // Made in Erbil: weighed here, no arrival check (shared/batchCloseCheck).
    createdInCountryId: china.destinationCountryId,
    createdInCity: "Erbil",
    createdById: userId,
  } as never);
}

/** The carrier's number, the same on a batch and on its twin (either way round). */
export async function setCarrierBatchNo(batchId: number, value: string | null) {
  const db = await need();
  const batch = await getBatchById(batchId);
  if (!batch) return;
  const key = normalizeCarrierBatchNo(value);
  const ids = [batchId];
  if (batch.twinOfBatchId) ids.push(batch.twinOfBatchId);
  const twins = await db.select({ id: batches.id }).from(batches).where(eq(batches.twinOfBatchId, batchId));
  ids.push(...twins.map((t) => Number(t.id)));
  await db.update(batches).set({ carrierBatchNo: key }).where(inArray(batches.id, ids));
}

/** Groups whose carrier billed more kilos than our customers were charged on, all goods in. For the bell. */
export async function countShortCarrierGroups(): Promise<Array<{ batchId: number; key: string; kg: number; usd: number }>> {
  const db = await need();
  const invoices = await db.select({ key: carrierGroupInvoices.carrierBatchNo }).from(carrierGroupInvoices)
    .where(sql`${carrierGroupInvoices.updatedAt} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 DAY)`);
  const out: Array<{ batchId: number; key: string; kg: number; usd: number }> = [];
  for (const inv of invoices) {
    const [b] = await db.select({ id: batches.id }).from(batches)
      .where(and(eq(batches.carrierBatchNo, inv.key), notInArray(batches.status, ["closed"]))).limit(1);
    if (!b) continue;
    const g = await getCarrierGroup(Number(b.id));
    if (g?.verdict === "short") out.push({ batchId: Number(b.id), key: inv.key, kg: r2((g.invoice?.billedKg ?? 0) - g.oursKg), usd: -g.differenceUsd });
  }
  return out;
}

/**
 * Our kilos against the carrier's, for the scan screens - on every batch,
 * not only one in a carrier group (owner, 2026-10-29: Quick Register said
 * nothing on AIR-2026-0789). A group compares against its invoice; a batch
 * on its own against the kilos the carrier billed it (chargedWeightKg, which
 * carrier loads also write); with neither, carrierKg is null and the strip
 * says it is missing.
 */
export async function getBatchKgCheck(batchId: number) {
  const g = await getCarrierGroup(batchId);
  if (g) return { key: g.key, carrierKg: g.invoice?.billedKg ?? null, oursKg: g.oursKg, allKg: g.allKg, stillComing: g.stillComing };
  const batch = await getBatchById(batchId);
  if (!batch) return null;
  const [m] = await memberFacts([batchId]);
  const billed = Number(batch.chargedWeightKg);
  return {
    key: null,
    carrierKg: billed > 0 ? billed : null,
    oursKg: m?.liveKg ?? 0,
    allKg: m?.kg ?? 0,
    stillComing: m?.stillComing ?? 0,
  };
}
