/**
 * How a box reaches the customer, every receipt that left the building, and
 * a customer's boxes at a glance (owner, 2026-10-19; shared/boxHandover).
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { deliveryBoxes, deliveryCarriers, boxReceiptEvents } from "../../drizzle/schema";
import { boxSettlements, boxSettlementLines } from "../../drizzle/schema/finance.schema";
import { users } from "../../drizzle/schema/users.schema";
import { getBoxesOutstanding, getBoxesPaidInFull } from "./boxSettlement.db";
import { withFix } from "@shared/fixAdvice";
import {
  cleanCarrierName,
  cleanTrackings,
  parseCarrierTrackings,
  STARTER_COURIERS,
  type CarrierKind,
  type HandoverMode,
} from "@shared/boxHandover";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

async function need() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

// ── drivers and delivery companies ───────────────────────────────────────

export async function listCarriers(kind: CarrierKind, userId: number) {
  const db = await need();
  const read = () => db
    .select({ id: deliveryCarriers.id, name: deliveryCarriers.name, phone: deliveryCarriers.phone })
    .from(deliveryCarriers)
    .where(and(eq(deliveryCarriers.kind, kind), eq(deliveryCarriers.isActive, true)))
    .orderBy(deliveryCarriers.name);
  let rows = await read();
  // The companies the owner named, the first time there are none at all.
  if (kind === "courier") {
    const [{ n }] = await db.select({ n: sql<number>`COUNT(*)` }).from(deliveryCarriers).where(eq(deliveryCarriers.kind, "courier"));
    if (Number(n) === 0) {
      await db.insert(deliveryCarriers).values(STARTER_COURIERS.map((name) => ({ kind: "courier" as const, name, createdById: userId })));
      rows = await read();
    }
  }
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name), phone: r.phone ?? null }));
}

export async function addCarrier(input: { kind: CarrierKind; name: string; phone?: string | null }, userId: number) {
  const db = await need();
  const name = cleanCarrierName(input.name);
  if (name.length < 2) {
    throw new Error(withFix("ناوەکە زۆر کورتە.", ["ناوی تەواوی شۆفێر یان کۆمپانیاکە بنووسە", "دووبارە «زیادکردن» لێبدە"]));
  }
  // The same name twice is one carrier, not two.
  const [same] = await db
    .select({ id: deliveryCarriers.id })
    .from(deliveryCarriers)
    .where(and(eq(deliveryCarriers.kind, input.kind), eq(deliveryCarriers.isActive, true), sql`LOWER(${deliveryCarriers.name}) = LOWER(${name})`))
    .limit(1);
  if (same) return { id: Number(same.id), name };
  const res = await db.insert(deliveryCarriers).values({
    kind: input.kind,
    name,
    phone: input.phone ? String(input.phone).trim().slice(0, 30) || null : null,
    createdById: userId,
  });
  return { id: Number((res as any)[0].insertId), name };
}

/** Off the list; its name stays on every box it took. */
export async function removeCarrier(id: number, userId: number) {
  const db = await need();
  await db.update(deliveryCarriers)
    .set({ isActive: false, removedAt: new Date(), removedById: userId })
    .where(eq(deliveryCarriers.id, id));
  return { success: true };
}

// ── the box's way to the customer ────────────────────────────────────────

export async function setBoxHandover(
  input: { boxId: number; mode: HandoverMode; carrierId?: number | null; trackings?: string[] },
  _userId: number,
) {
  const db = await need();
  let carrierId: number | null = null;
  let carrierName: string | null = null;
  if (input.mode !== "pickup") {
    if (!input.carrierId) {
      throw new Error(withFix(
        input.mode === "driver" ? "شۆفێرێک هەڵنەبژێردراوە." : "کۆمپانیایەکی گواستنەوە هەڵنەبژێردراوە.",
        ["لە لیستەکە یەکێک هەڵبژێرە", "ئەگەر لە لیستەکەدا نییە، ناوەکەی بنووسە و «زیادکردن» لێبدە"],
      ));
    }
    const [c] = await db.select().from(deliveryCarriers).where(eq(deliveryCarriers.id, input.carrierId)).limit(1);
    if (!c || !c.isActive || c.kind !== input.mode) {
      throw new Error(withFix("ئەم شۆفێر یان کۆمپانیایە لە لیستەکەدا نەماوە.", ["لیستەکە نوێ بکەرەوە و یەکێکی تر هەڵبژێرە"]));
    }
    carrierId = Number(c.id);
    carrierName = String(c.name);
  }
  const trackings = input.mode === "courier" ? cleanTrackings(input.trackings ?? []) : [];
  await db.update(deliveryBoxes).set({
    handoverMode: input.mode,
    carrierId,
    carrierName,
    carrierTrackings: trackings.length ? JSON.stringify(trackings) : null,
  }).where(eq(deliveryBoxes.id, input.boxId));
  return { mode: input.mode, carrierId, carrierName, trackings };
}

// ── every receipt that left the building ─────────────────────────────────

const HTML_LIMIT = 4_000_000;

export async function logReceiptEvent(
  input: {
    boxId: number;
    action: "print" | "pdf" | "whatsapp";
    totalUsd: number;
    discountUsd?: number;
    discountReason?: string | null;
    paidBeforeUsd?: number;
    advanceUsd?: number;
    dueUsd?: number | null;
    rate?: number | null;
    dueIqd?: number | null;
    language?: string | null;
    html?: string | null;
  },
  userId: number,
) {
  const db = await need();
  const [box] = await db.select({ customerId: deliveryBoxes.customerId }).from(deliveryBoxes).where(eq(deliveryBoxes.id, input.boxId)).limit(1);
  if (!box) return { id: null };
  const html = input.html && input.html.length <= HTML_LIMIT ? input.html : null;
  const res = await db.insert(boxReceiptEvents).values({
    boxId: input.boxId,
    customerId: Number(box.customerId),
    action: input.action,
    totalUsd: round2(input.totalUsd).toFixed(2),
    discountUsd: round2(input.discountUsd ?? 0).toFixed(2),
    discountReason: input.discountReason ?? null,
    paidBeforeUsd: round2(input.paidBeforeUsd ?? 0).toFixed(2),
    advanceUsd: round2(input.advanceUsd ?? 0).toFixed(2),
    dueUsd: input.dueUsd == null ? null : round2(input.dueUsd).toFixed(2),
    rate: input.rate == null ? null : String(input.rate),
    dueIqd: input.dueIqd == null ? null : String(Math.round(input.dueIqd)),
    language: input.language ?? null,
    html,
    createdById: userId,
    // Written by the app like the receipts beside it, so the two sort on one clock.
    createdAt: new Date(),
  });
  return { id: Number((res as any)[0].insertId) };
}

export async function receiptEventHtml(id: number): Promise<string | null> {
  const db = await need();
  const [row] = await db.select({ html: boxReceiptEvents.html }).from(boxReceiptEvents).where(eq(boxReceiptEvents.id, id)).limit(1);
  return row?.html ?? null;
}

// ── a customer's boxes at a glance ───────────────────────────────────────

export interface CustomerBoxHistoryEvent {
  kind: "print" | "pdf" | "whatsapp" | "payment" | "reversed";
  at: Date;
  by: string | null;
  totalUsd?: number;
  paidUsd?: number;
  discountUsd?: number;
  discountReason?: string | null;
  receipt?: string | null;
  reason?: string | null;
  /** A receipt event whose paper can be opened again. */
  eventId?: number;
  hasPaper?: boolean;
}

export async function customerBoxesOverview(customerId: number) {
  const db = await need();
  const boxes = await db
    .select({
      id: deliveryBoxes.id,
      boxCode: deliveryBoxes.boxCode,
      status: deliveryBoxes.status,
      totalPackages: deliveryBoxes.totalPackages,
      totalValueUsd: deliveryBoxes.totalValueUsd,
      createdAt: deliveryBoxes.createdAt,
      handoverMode: deliveryBoxes.handoverMode,
      carrierName: deliveryBoxes.carrierName,
      carrierTrackings: deliveryBoxes.carrierTrackings,
    })
    .from(deliveryBoxes)
    .where(eq(deliveryBoxes.customerId, customerId))
    .orderBy(desc(deliveryBoxes.id))
    .limit(200);
  const ids = boxes.map((b) => Number(b.id));
  if (ids.length === 0) {
    return { boxes: [], totals: { boxes: 0, paidUsd: 0, discountUsd: 0, owedUsd: 0 }, discounts: [] };
  }

  const [owed, paidInFull, receipts, events] = await Promise.all([
    getBoxesOutstanding(ids),
    getBoxesPaidInFull(ids),
    db.select({
        id: boxSettlements.id,
        boxId: boxSettlements.boxId,
        number: boxSettlements.settlementNumber,
        status: boxSettlements.status,
        paidUsd: boxSettlements.paidUsd,
        discountUsd: boxSettlements.discountUsd,
        createdAt: boxSettlements.createdAt,
        reversedAt: boxSettlements.reversedAt,
        reversalReason: boxSettlements.reversalReason,
        by: users.name,
        reversedById: boxSettlements.reversedById,
      })
      .from(boxSettlements)
      .leftJoin(users, eq(users.id, boxSettlements.createdById))
      .where(inArray(boxSettlements.boxId, ids)),
    db.select({
        id: boxReceiptEvents.id,
        boxId: boxReceiptEvents.boxId,
        action: boxReceiptEvents.action,
        totalUsd: boxReceiptEvents.totalUsd,
        discountUsd: boxReceiptEvents.discountUsd,
        discountReason: boxReceiptEvents.discountReason,
        hasPaper: sql<number>`(${boxReceiptEvents.html} IS NOT NULL)`,
        createdAt: boxReceiptEvents.createdAt,
        by: users.name,
      })
      .from(boxReceiptEvents)
      .leftJoin(users, eq(users.id, boxReceiptEvents.createdById))
      .where(inArray(boxReceiptEvents.boxId, ids)),
  ]);

  // Who undid a receipt, and why each discount was given.
  const reverserIds = Array.from(new Set(receipts.map((r) => Number(r.reversedById)).filter(Boolean)));
  const reversers = reverserIds.length
    ? new Map((await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, reverserIds))).map((u) => [Number(u.id), u.name]))
    : new Map<number, string | null>();
  const receiptIds = receipts.map((r) => Number(r.id));
  const reasons = receiptIds.length
    ? await db.select({
        settlementId: boxSettlementLines.settlementId,
        reason: boxSettlementLines.discountReason,
        note: boxSettlementLines.discountNote,
      })
      .from(boxSettlementLines)
      .where(and(inArray(boxSettlementLines.settlementId, receiptIds), sql`${boxSettlementLines.discountUsd} > 0`))
    : [];
  const reasonOf = new Map<number, string>();
  for (const r of reasons) {
    const text = [r.reason, r.note].filter(Boolean).join(" — ");
    if (text && !reasonOf.has(Number(r.settlementId))) reasonOf.set(Number(r.settlementId), text);
  }

  const historyOf = new Map<number, CustomerBoxHistoryEvent[]>();
  const push = (boxId: number, e: CustomerBoxHistoryEvent) => {
    const list = historyOf.get(boxId) ?? [];
    list.push(e);
    historyOf.set(boxId, list);
  };
  for (const e of events) {
    push(Number(e.boxId), {
      kind: e.action as "print" | "pdf" | "whatsapp",
      at: e.createdAt,
      by: e.by ?? null,
      totalUsd: Number(e.totalUsd),
      discountUsd: Number(e.discountUsd),
      discountReason: e.discountReason ?? null,
      eventId: Number(e.id),
      hasPaper: Number(e.hasPaper) === 1,
    });
  }
  const discounts: Array<{ boxCode: string; receipt: string; usd: number; reason: string | null; at: Date }> = [];
  let paidUsd = 0;
  let discountUsd = 0;
  for (const r of receipts) {
    const boxId = Number(r.boxId);
    push(boxId, {
      kind: "payment",
      at: r.createdAt,
      by: r.by ?? null,
      paidUsd: Number(r.paidUsd),
      discountUsd: Number(r.discountUsd),
      discountReason: reasonOf.get(Number(r.id)) ?? null,
      receipt: r.number,
    });
    if (r.status === "reversed" && r.reversedAt) {
      push(boxId, {
        kind: "reversed",
        at: r.reversedAt,
        by: reversers.get(Number(r.reversedById)) ?? null,
        receipt: r.number,
        reason: r.reversalReason ?? null,
      });
    } else if (r.status === "confirmed") {
      paidUsd += Number(r.paidUsd);
      discountUsd += Number(r.discountUsd);
      if (Number(r.discountUsd) > 0) {
        const box = boxes.find((b) => Number(b.id) === boxId);
        discounts.push({ boxCode: String(box?.boxCode ?? boxId), receipt: r.number, usd: Number(r.discountUsd), reason: reasonOf.get(Number(r.id)) ?? null, at: r.createdAt });
      }
    }
  }

  let owedUsd = 0;
  const out = boxes.map((b) => {
    const id = Number(b.id);
    const due = round2(owed.get(id) ?? 0);
    if (b.status !== "cancelled") owedUsd += due;
    // Newest first; within the same second, the order things happen in -
    // printed, then paid, then undone.
    const step = (e: CustomerBoxHistoryEvent) => (e.kind === "reversed" ? 2 : e.kind === "payment" ? 1 : 0);
    const history = (historyOf.get(id) ?? []).sort((x, y) =>
      (new Date(y.at).getTime() - new Date(x.at).getTime()) || (step(y) - step(x)) || (Number(y.eventId ?? 0) - Number(x.eventId ?? 0)));
    const live = receipts.filter((r) => Number(r.boxId) === id && r.status === "confirmed");
    return {
      id,
      boxCode: String(b.boxCode),
      status: String(b.status),
      totalPackages: Number(b.totalPackages ?? 0),
      totalValueUsd: Number(b.totalValueUsd ?? 0),
      createdAt: b.createdAt,
      handoverMode: b.handoverMode ?? null,
      carrierName: b.carrierName ?? null,
      carrierTrackings: parseCarrierTrackings(b.carrierTrackings),
      paidInFull: paidInFull.has(id),
      hasReceipt: live.length > 0,
      owedUsd: due,
      discountUsd: round2(live.reduce((s, r) => s + Number(r.discountUsd), 0)),
      history,
    };
  });

  return {
    boxes: out,
    totals: { boxes: out.filter((b) => b.status !== "cancelled").length, paidUsd: round2(paidUsd), discountUsd: round2(discountUsd), owedUsd: round2(owedUsd) },
    discounts: discounts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  };
}

/**
 * Where a parcel just registered should go (owner, 2026-10-21: «بۆکس دروست
 * بکە بۆی» on Quick Register).
 *
 * open - the customer's box still being filled, by his own words: no
 *        receipt printed or sent for it (no print, PDF or WhatsApp in its
 *        history), not paid in full, still open (not sealed, cancelled or
 *        handed over).
 * last - how the customer's newest box went out, so a new one goes the same
 *        way without a touch: the way, the driver or company, the delivery
 *        cost and price, and where to.
 */
export async function boxChoiceForCustomer(customerId: number) {
  const db = await need();
  const boxes = await db
    .select({
      id: deliveryBoxes.id,
      boxCode: deliveryBoxes.boxCode,
      status: deliveryBoxes.status,
      totalPackages: deliveryBoxes.totalPackages,
      deliveryMethod: deliveryBoxes.deliveryMethod,
      destinationCity: deliveryBoxes.destinationCity,
      destinationAddress: deliveryBoxes.destinationAddress,
      recipientName: deliveryBoxes.recipientName,
      recipientPhone: deliveryBoxes.recipientPhone,
      deliveryCostUsd: deliveryBoxes.deliveryCostUsd,
      deliveryChargeUsd: deliveryBoxes.deliveryChargeUsd,
      handoverMode: deliveryBoxes.handoverMode,
      carrierId: deliveryBoxes.carrierId,
      carrierName: deliveryBoxes.carrierName,
      createdAt: deliveryBoxes.createdAt,
    })
    .from(deliveryBoxes)
    .where(and(eq(deliveryBoxes.customerId, customerId), sql`${deliveryBoxes.status} <> 'cancelled'`))
    .orderBy(desc(deliveryBoxes.id))
    .limit(50);
  if (boxes.length === 0) return { open: null, last: null };

  const ids = boxes.map((b) => Number(b.id));
  const [paidInFull, sent] = await Promise.all([
    getBoxesPaidInFull(ids),
    db.selectDistinct({ boxId: boxReceiptEvents.boxId }).from(boxReceiptEvents).where(inArray(boxReceiptEvents.boxId, ids)),
  ]);
  const paid = new Set(Array.from(paidInFull as Iterable<number>).map(Number));
  const papered = new Set(sent.map((s) => Number(s.boxId)));
  const open = boxes.find((b) =>
    // "open": a sealed box takes no more parcels (deliveryBox.addItem).
    b.status === "open" && !paid.has(Number(b.id)) && !papered.has(Number(b.id)),
  ) ?? null;
  const last = boxes[0];
  return {
    open: open && {
      id: Number(open.id),
      boxCode: open.boxCode,
      totalPackages: Number(open.totalPackages ?? 0),
      handoverMode: open.handoverMode ?? null,
      carrierName: open.carrierName ?? null,
    },
    last: {
      deliveryMethod: last.deliveryMethod,
      destinationCity: last.destinationCity ?? null,
      destinationAddress: last.destinationAddress ?? null,
      recipientPhone: last.recipientPhone ?? null,
      deliveryCostUsd: String(last.deliveryCostUsd ?? "0"),
      deliveryChargeUsd: String(last.deliveryChargeUsd ?? "0"),
      handoverMode: (last.handoverMode ?? null) as HandoverMode | null,
      carrierId: last.carrierId == null ? null : Number(last.carrierId),
      carrierName: last.carrierName ?? null,
    },
  };
}
