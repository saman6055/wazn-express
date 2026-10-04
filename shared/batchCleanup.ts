/**
 * Deleting a batch together with what hangs from it.
 *
 * Owner, 2026-10-04, on AIR-2026-007 (a test batch of eight parcels on his own
 * account, five months old, with a box, a receipt and nine invoices): "I cannot
 * go to all those places when I delete a batch. Tell me which ones, put a tick
 * beside each, and let them go with it."
 *
 * So the delete window lists everything tied to the batch — receipts, parcels,
 * boxes, invoices — each with a tick, and what each tick does to every
 * customer's account is shown before anything happens. The order the server
 * then works in is fixed, because each step needs the one before it:
 *
 *   1. receipts are undone   (the money goes back on the account)
 *   2. parcels are deleted   (their charges come off the account)
 *   3. boxes are deleted     (only once nothing in them is left)
 *   4. invoices are cancelled (kept, marked cancelled — never erased)
 *   5. the batch is deleted  (to the recycle bin)
 *
 * The rules that keep this honest live here, shared by the window (which shows
 * them as you tick) and the server (which refuses anything they refuse):
 *
 *   - A parcel paid for on a receipt goes only with that receipt undone.
 *   - A box goes only with everything in it, and its receipts undone.
 *   - A box holding parcels of another batch is not offered, nor its receipt
 *     or parcels: undoing it would reach into a shipment nobody asked about.
 *   - Nothing may leave a customer in credit (owner's rule: credit exists only
 *     when a customer really paid more; undoing never makes it).
 */

import { withFix } from "./fixAdvice";

/**
 * A charge an ORDER posted. Commission and full-package freight is posted as a
 * `package` charge whose reference is the order's id — which can equal some
 * parcel's id. Older rows began with «کڕین بە عمولە», newer ones with «کڕین بە
 * تێچوو»; every one of them names its order code.
 */
export function isOrderChargeText(description: string | null | undefined): boolean {
  const d = String(description ?? "").trimStart();
  return (
    d.startsWith("کڕین بە تێچوو") ||
    d.startsWith("کڕین بە عمولە") ||
    d.startsWith("پاکێجی تەواو") ||
    /\b(CM|FP|PR)-[A-Z0-9]{5,}/.test(d)
  );
}

export interface ReceiptFact {
  id: number;
  number: string;
  boxId: number;
  boxCode: string;
  customerId: number;
  /** What undoing it puts back on the account: the payment and its discount. */
  putBackUsd: number;
  eligible: boolean;
  why?: string;
}

export interface ParcelFact {
  id: number;
  code: string;
  tracking: string | null;
  customerId: number | null;
  weightKg: number;
  priceUsd: number;
  /** Charges standing on the account for this parcel — what deleting it takes off. */
  chargedUsd: number;
  /** Confirmed receipts it was paid on. */
  receiptIds: number[];
  boxIds: number[];
  eligible: boolean;
  why?: string;
}

export interface BoxFact {
  id: number;
  code: string;
  status: string;
  customerId: number | null;
  parcelIds: number[];
  /** Items in it that are not parcels of this batch. */
  foreignItems: number;
  receiptIds: number[];
  eligible: boolean;
  why?: string;
}

export interface InvoiceFact {
  id: number;
  number: string;
  totalUsd: number;
  status: string;
}

export interface CleanupFacts {
  batch: { id: number; code: string; status: string };
  receipts: ReceiptFact[];
  parcels: ParcelFact[];
  boxes: BoxFact[];
  invoices: InvoiceFact[];
  /** Orders still alive on this batch — named, never touched from here. */
  liveOrders: number;
  /** Every customer any of the above touches, as the account stands now. */
  customers: Array<{ id: number; code: string; balanceUsd: number }>;
}

export interface CleanupSelection {
  receiptIds: number[];
  parcelIds: number[];
  boxIds: number[];
  invoiceIds: number[];
}

export interface CustomerEffect {
  customerId: number;
  code: string;
  beforeUsd: number;
  afterUsd: number;
}

export interface CleanupPlan {
  /** Why it cannot be done as ticked; empty when it can. */
  problems: string[];
  effects: CustomerEffect[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function planCleanup(facts: CleanupFacts, sel: CleanupSelection): CleanupPlan {
  const problems: string[] = [];
  const receipts = new Set(sel.receiptIds);
  const parcels = new Set(sel.parcelIds);
  const byReceipt = new Map(facts.receipts.map((r) => [r.id, r]));
  const byParcel = new Map(facts.parcels.map((p) => [p.id, p]));
  const byBox = new Map(facts.boxes.map((b) => [b.id, b]));
  const invoiceIds = new Set(facts.invoices.map((i) => i.id));

  for (const id of sel.receiptIds) {
    const r = byReceipt.get(id);
    if (!r) problems.push(`وەسڵی #${id} بەم باچەوە نەبەستراوە.`);
    else if (!r.eligible) problems.push(`وەسڵی ${r.number}: ${r.why ?? "لێرەوە هەڵناوەشێنرێتەوە"}`);
  }
  for (const id of sel.parcelIds) {
    const p = byParcel.get(id);
    if (!p) { problems.push(`پاکەتی #${id} لەم باچەدا نییە.`); continue; }
    if (!p.eligible) { problems.push(`پاکەتی ${p.code}: ${p.why ?? "لێرەوە ناسڕدرێتەوە"}`); continue; }
    for (const rid of p.receiptIds) {
      if (!receipts.has(rid)) {
        problems.push(`پاکەتی ${p.code} پارەکەی لە وەسڵی ${byReceipt.get(rid)?.number ?? `#${rid}`} وەرگیراوە — ئەو وەسڵەش هەڵبژێرە.`);
      }
    }
  }
  for (const id of sel.boxIds) {
    const b = byBox.get(id);
    if (!b) { problems.push(`بۆکسی #${id} بەم باچەوە نەبەستراوە.`); continue; }
    if (!b.eligible) { problems.push(`بۆکسی ${b.code}: ${b.why ?? "لێرەوە ناسڕدرێتەوە"}`); continue; }
    const left = b.parcelIds.filter((pid) => !parcels.has(pid));
    if (left.length > 0) problems.push(`بۆکسی ${b.code} هێشتا ${left.length} پاکەتی تێدایە — پاکەتەکانیشی هەڵبژێرە.`);
    const open = b.receiptIds.filter((rid) => !receipts.has(rid));
    if (open.length > 0) problems.push(`بۆکسی ${b.code} وەسڵی لەسەرە — وەسڵەکەشی هەڵبژێرە.`);
  }
  for (const id of sel.invoiceIds) {
    if (!invoiceIds.has(id)) problems.push(`پسوولەی #${id} بەم باچەوە نەبەستراوە.`);
  }

  // What every touched account becomes: receipts undone put money back on it,
  // parcels deleted take their charges off.
  const delta = new Map<number, number>();
  for (const id of sel.receiptIds) {
    const r = byReceipt.get(id);
    if (r) delta.set(r.customerId, (delta.get(r.customerId) ?? 0) + r.putBackUsd);
  }
  for (const id of sel.parcelIds) {
    const p = byParcel.get(id);
    if (p?.customerId) delta.set(p.customerId, (delta.get(p.customerId) ?? 0) - p.chargedUsd);
  }
  const effects: CustomerEffect[] = [];
  for (const [customerId, change] of Array.from(delta.entries())) {
    if (Math.abs(change) < 0.005) continue;
    const c = facts.customers.find((x) => x.id === customerId);
    const beforeUsd = round2(c?.balanceUsd ?? 0);
    const afterUsd = round2(beforeUsd + change);
    effects.push({ customerId, code: c?.code ?? `#${customerId}`, beforeUsd, afterUsd });
    if (afterUsd < -0.005) {
      problems.push(
        `حیسابی ${c?.code ?? `#${customerId}`} دەبێت بە کریدیتی ${usd(-afterUsd)} — سڕینەوە کریدیت دروست ناکات. ` +
        "ئەو پاکەتانەی ئەم کڕیارە کە پارەیان لە دەرەوەی سیستەم وەرگیراوە هەڵمەبژێرە، یان وەسڵەکەیان لەگەڵدا هەڵبژێرە.",
      );
    }
  }
  return { problems, effects };
}

/** The server's refusal: every problem, then the cure. */
export function cleanupRefusal(problems: readonly string[]): string {
  return withFix(
    `باچەکە نەسڕایەوە و هیچ شتێک نەگۆڕا:\n${problems.map((p) => `• ${p}`).join("\n")}`,
    [
      "لە پەنجەرەی سڕینەوەدا هەڵبژاردنەکان ڕاست بکەرەوە",
      "دووبارە «سڕینەوە» دابگرە",
    ],
  );
}
