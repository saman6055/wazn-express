/**
 * One colour per kind of status, for every staff screen.
 *
 * An audit in September 2026 found about thirty private status-colour maps on
 * the staff side, in nine different chip recipes. In transit alone came out
 * blue, sky, amber, orange and purple on different screens; "returned" was
 * grey on one and red on another; and on three dashboards the pill and the
 * dropdown dot beside it disagreed on the same row. The portal already had one
 * palette (BATCH_STATUS_TONE, PACKAGE_STATUS_TONE). This is the same palette
 * for everything else, so staff and customers see a status in one colour.
 *
 *   success  — done: delivered, paid, closed, and — the owner's palette — any
 *              shipment already in Iraq: arrived, at the depot, ready
 *   progress — moving: in transit, ordered, being bought, out for delivery
 *   waiting  — a wait, or a thing to watch: pending, customs, unpaid
 *   problem  — cancelled, rejected, returned, failed, overdue
 *   neutral  — not begun, or no longer counted: registered, preparing, draft
 */

export type Tone = "success" | "progress" | "waiting" | "problem" | "neutral";

/** The chip: tinted background, readable text, both themes. */
export const TONE_CHIP: Record<Tone, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  progress: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  waiting: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  problem: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

/** The chip's two halves, for screens that put them on two elements. */
export const TONE_BG: Record<Tone, string> = {
  success: "bg-emerald-100 dark:bg-emerald-950/40",
  progress: "bg-sky-100 dark:bg-sky-950/40",
  waiting: "bg-amber-100 dark:bg-amber-950/40",
  problem: "bg-red-100 dark:bg-red-950/40",
  neutral: "bg-slate-100 dark:bg-slate-800",
};

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-emerald-700 dark:text-emerald-300",
  progress: "text-sky-700 dark:text-sky-300",
  waiting: "text-amber-700 dark:text-amber-300",
  problem: "text-red-700 dark:text-red-300",
  neutral: "text-slate-700 dark:text-slate-300",
};

/**
 * A solid dot or bar. Three dropdowns used the chip's first class for their
 * dots — the pale -100 background — which barely showed on a white menu.
 */
export const TONE_DOT: Record<Tone, string> = {
  success: "bg-emerald-500",
  progress: "bg-sky-500",
  waiting: "bg-amber-500",
  problem: "bg-red-500",
  neutral: "bg-slate-400",
};

/** The same colours, for charts that take hex values. */
export const TONE_HEX: Record<Tone, string> = {
  success: "#10b981",
  progress: "#0ea5e9",
  waiting: "#f59e0b",
  problem: "#ef4444",
  neutral: "#94a3b8",
};

export type StatusKind = "order" | "package" | "batch" | "payment" | "box" | "claim";

const STATUS_TONE: Record<string, Tone> = {
  // success — done
  delivered: "success",
  completed: "success",
  closed: "success",
  paid: "success",
  received: "success",
  resolved: "success",
  published: "success",
  active: "success",
  success: "success",
  good: "success",
  moved: "success",
  approved: "success",
  // in Iraq — the owner's palette, as BATCH_STATUS_TONE / PACKAGE_STATUS_TONE
  arrived: "success",
  at_depot: "success",
  ready_for_delivery: "success",
  // progress — moving
  in_transit: "progress",
  on_route: "progress",
  shipped: "progress",
  out_for_delivery: "progress",
  ordered: "progress",
  purchasing: "progress",
  purchased: "progress",
  tracking_added: "progress",
  arrived_china: "progress",
  confirmed: "progress",
  processing: "progress",
  sending: "progress",
  in_progress: "progress",
  issued: "progress",
  open: "progress",
  matched: "progress",
  // waiting — a wait, or a thing to watch
  pending: "waiting",
  pending_quote: "waiting",
  quoted: "waiting",
  customs: "waiting",
  customs_processing: "waiting",
  scheduled: "waiting",
  partially_paid: "waiting",
  unpaid: "waiting",
  unclaimed: "waiting",
  restructured: "waiting",
  warning: "waiting",
  ready: "waiting",
  // problem
  cancelled: "problem",
  canceled: "problem",
  rejected: "problem",
  returned: "problem",
  failed: "problem",
  overdue: "problem",
  error: "problem",
  critical: "problem",
  out_of_stock: "problem",
  // neutral — not begun, or no longer counted
  registered: "neutral",
  in_batch: "neutral",
  in_china_warehouse: "neutral",
  quality_check: "neutral",
  preparing: "neutral",
  draft: "neutral",
  inactive: "neutral",
  archived: "neutral",
  hidden: "neutral",
  refunded: "neutral",
};

/**
 * The same word, a different moment: an approved order has only just been
 * accepted — the buying is still ahead — while an approved claim is settled.
 */
const KIND_OVERRIDES: Partial<Record<StatusKind, Record<string, Tone>>> = {
  order: { approved: "progress" },
};

export function statusTone(status: string | null | undefined, kind?: StatusKind): Tone {
  const value = (status ?? "").toLowerCase().trim();
  return (kind && KIND_OVERRIDES[kind]?.[value]) || STATUS_TONE[value] || "neutral";
}

export const statusChip = (status: string | null | undefined, kind?: StatusKind) =>
  TONE_CHIP[statusTone(status, kind)];

export const statusDot = (status: string | null | undefined, kind?: StatusKind) =>
  TONE_DOT[statusTone(status, kind)];

export const statusBgText = (status: string | null | undefined, kind?: StatusKind) => {
  const tone = statusTone(status, kind);
  return { bg: TONE_BG[tone], text: TONE_TEXT[tone] };
};
