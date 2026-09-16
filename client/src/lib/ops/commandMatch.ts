/**
 * How the quick action hub (Ctrl+K) decides what a few typed letters mean.
 *
 * The office types in four scripts and often in none of them properly: a
 * Kurdish label searched with an Arabic keyboard (ي for ی, ك for ک), a
 * customer code in lower case, a phone number with Eastern digits, a tracking
 * number copied out of WeChat with spaces in it. Everything is folded to one
 * form before it is compared, so what was meant is what is found.
 *
 * Pure and synchronous: the hub runs this on every keystroke, over every
 * customer, and it has to answer inside the same frame.
 */
import { customerCodeOnly } from "@shared/customerCode";

/** Harakat, tatweel and invisible direction marks — none of them change a word. */
const MARKS = /[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** One form for every way the same letter or digit is typed. */
export function normalizeSearch(text: string | null | undefined): string {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(MARKS, "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u064A\u0649]/g, "\u06CC") // Arabic yeh, alef maksura → Kurdish yeh
    .replace(/\u0643/g, "\u06A9") // Arabic kaf → keheh
    .replace(/\u0629/g, "\u06D5") // teh marbuta → ae
    .replace(/[\u0623\u0625\u0622]/g, "\u0627") // hamza forms of alef → alef
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Letters and digits only — for codes, trackings and phones, where punctuation is noise. */
export function compactKey(text: string | null | undefined): string {
  return normalizeSearch(text).replace(/[^a-z0-9\u0600-\u06FF]/g, "");
}

/**
 * How well `query` matches `text`, 0 when it does not.
 *
 *   100  the text starts with it
 *    80  a word in the text starts with it
 *    60  it appears anywhere
 *    50  every word of it appears somewhere
 *    20  its letters appear in order (typos of omission: "qckreg")
 */
export function matchScore(query: string, text: string | null | undefined): number {
  const q = normalizeSearch(query);
  if (!q) return 1;
  const t = normalizeSearch(text);
  if (!t) return 0;
  if (t.startsWith(q)) return 100;
  if (t.split(/[\s/\-_·()]+/).some((word) => word.startsWith(q))) return 80;
  if (t.includes(q)) return 60;
  const words = q.split(" ").filter(Boolean);
  if (words.length > 1 && words.every((w) => t.includes(w))) return 50;
  if (q.length >= 3 && isSubsequence(q.replace(/ /g, ""), t)) return 20;
  return 0;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return i === needle.length;
}

/** The best score of any of the texts. */
export function bestScore(query: string, texts: ReadonlyArray<string | null | undefined>): number {
  let best = 0;
  for (const text of texts) best = Math.max(best, matchScore(query, text));
  return best;
}

/**
 * Something that reads as a tracking number rather than a word: eight or more
 * letters and digits, at least five of them digits. "AZ002" is a customer,
 * "YT7524601234567" is a parcel, "کڕیار" is neither.
 */
export function looksLikeTracking(query: string): boolean {
  const key = compactKey(query).toUpperCase();
  if (!/^[A-Z0-9]{8,40}$/.test(key)) return false;
  return (key.match(/\d/g)?.length ?? 0) >= 5;
}

/** A customer code as the office writes them: a few letters, then digits. */
export function looksLikeCustomerCode(query: string): boolean {
  return /^[a-z]{1,4}\d{1,6}$/.test(compactKey(query));
}

export interface CustomerLike {
  id: number;
  customerCode?: string | null;
  fullName?: string | null;
  fullNameKurdish?: string | null;
  mobileNumber?: string | null;
  isActive?: boolean | null;
}

/**
 * A customer with its search keys worked out once.
 *
 * The hub ranks every customer on every keystroke; folding each name and code
 * afresh each time is what would make it lag behind the typing on a list of
 * thousands. Prepared once per list, a keystroke is a few string compares.
 */
export interface PreparedCustomer<T extends CustomerLike = CustomerLike> {
  customer: T;
  code: string;
  phone: string;
  names: string[];
}

export function prepareCustomers<T extends CustomerLike>(customers: readonly T[]): PreparedCustomer<T>[] {
  return customers.map((customer) => ({
    customer,
    code: compactKey(customerCodeOnly(customer.customerCode)),
    phone: String(customer.mobileNumber ?? "").replace(/\D/g, ""),
    names: [customer.fullName, customer.fullNameKurdish, customer.customerCode]
      .map((n) => normalizeSearch(n))
      .filter(Boolean),
  }));
}

/**
 * How well a customer matches, 0 when not at all.
 *
 * A code typed exactly is the strongest answer there is: it names one person.
 * A phone number is matched on its digits alone, from four of them, so
 * "0750 123" and "+964750123" find the same customer.
 */
function preparedScore(query: string, q: string, p: PreparedCustomer): number {
  if (p.code && p.code === q) return 130;
  if (p.code && p.code.startsWith(q)) return 110;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 4 && digits.length === q.length) {
    if (p.phone.includes(digits) || p.phone.includes(digits.replace(/^0+/, ""))) return 95;
  }
  let byName = 0;
  for (const name of p.names) byName = Math.max(byName, matchScore(query, name));
  return byName > 0 ? Math.min(90, byName) : 0;
}

export function customerScore(query: string, customer: CustomerLike): number {
  const q = compactKey(query);
  if (!q) return 0;
  return preparedScore(query, q, prepareCustomers([customer])[0]);
}

/** The customers worth showing for a query, best first, from a list prepared once. */
export function rankPreparedCustomers<T extends CustomerLike>(
  query: string,
  prepared: readonly PreparedCustomer<T>[],
  limit = 6,
): T[] {
  const q = compactKey(query);
  if (!q) return [];
  const scored: Array<{ c: T; s: number }> = [];
  for (const p of prepared) {
    const s = preparedScore(query, q, p);
    if (s > 0) scored.push({ c: p.customer, s: p.customer.isActive === false ? s - 5 : s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.c);
}

/** The same, for a list used once. */
export function rankCustomers<T extends CustomerLike>(query: string, customers: readonly T[], limit = 6): T[] {
  return rankPreparedCustomers(query, prepareCustomers(customers), limit);
}

export interface BatchLike {
  id: number;
  batchCode?: string | null;
  status?: string | null;
  createdAt?: Date | string | null;
}

/** Batches that have not left yet come first: they are the ones still being worked on. */
const BATCH_STATUS_ORDER: Record<string, number> = {
  preparing: 0,
  in_transit: 1,
  arrived: 2,
  customs: 3,
  at_depot: 4,
  delivered: 5,
  closed: 6,
};

/**
 * How well a batch code matches. A code typed whole outranks everything,
 * a tracking-shaped guess included: "AIR2026041" is somebody asking for that
 * batch, not for a parcel.
 */
export function batchScore(query: string, batch: BatchLike): number {
  const q = compactKey(query);
  if (!q) return 1;
  const code = compactKey(batch.batchCode);
  if (!code) return 0;
  if (code === q) return 150;
  if (code.startsWith(q)) return 120;
  return code.includes(q) ? 90 : 0;
}

export function rankBatches<T extends BatchLike>(query: string, batches: readonly T[], limit = 5): T[] {
  const order = (b: T) => BATCH_STATUS_ORDER[String(b.status ?? "")] ?? 9;
  const time = (b: T) => (b.createdAt ? new Date(b.createdAt).getTime() : 0);
  const rows = batches
    .map((b) => ({ b, s: batchScore(query, b) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || order(a.b) - order(b.b) || time(b.b) - time(a.b));
  return rows.slice(0, limit).map((x) => x.b);
}
