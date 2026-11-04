/**
 * What a customer's session does that the portal never does.
 *
 * The owner, 2026-11-05: «ئەگەر هەستت بە جووڵەی نائاسایی هەر کڕیارێک کرد کە
 * هەوڵی دزەکردن یان دۆزینەوەی کەلێن بدات، یەکسەر بلۆکی بکە، ڕاپۆرتی ورد
 * تۆمار بکە و بۆ ئادمینی سەرەکی بنێرە».
 *
 * A customer who makes mistakes must never be blocked for them, so only what
 * the portal itself cannot produce is counted — and only many of it, of many
 * kinds, inside ten minutes:
 *
 *   staff_door        knocking on office doors (staff/admin-only procedures);
 *                     the portal's screens never call one, and it takes five
 *                     DIFFERENT ones, so one buggy screen repeating itself
 *                     never reaches it
 *   unknown_procedure asking for procedures that do not exist — guessing at
 *                     names; eight different ones
 *   malformed_input   inputs the forms cannot produce, sent to many places —
 *                     thirty, across at least three procedures
 *   runnable_upload   trying to upload a page or a script (html, svg, js);
 *                     no picker in the portal offers one; twice
 *
 * One crossed line blocks the account at once; the main admin is told, and
 * one press in Portal Center opens it again.
 */
export type SuspiciousKind = "staff_door" | "unknown_procedure" | "malformed_input" | "runnable_upload";

export interface SuspiciousEvent {
  at: number;
  kind: SuspiciousKind;
  path: string;
  ip: string;
  agent: string;
}

export const WATCH_WINDOW_MS = 10 * 60 * 1000;

export const THRESHOLDS: Record<SuspiciousKind, { events: number; distinctPaths: number }> = {
  staff_door: { events: 5, distinctPaths: 5 },
  unknown_procedure: { events: 8, distinctPaths: 8 },
  malformed_input: { events: 30, distinctPaths: 3 },
  runnable_upload: { events: 2, distinctPaths: 1 },
};

/** The first kind whose line is crossed inside the window, or null. */
export function crossedLine(events: readonly SuspiciousEvent[], now: number): SuspiciousKind | null {
  const recent = events.filter((e) => now - e.at <= WATCH_WINDOW_MS);
  for (const kind of Object.keys(THRESHOLDS) as SuspiciousKind[]) {
    const mine = recent.filter((e) => e.kind === kind);
    const rule = THRESHOLDS[kind];
    if (mine.length >= rule.events && new Set(mine.map((e) => e.path)).size >= rule.distinctPaths) return kind;
  }
  return null;
}

/** What each kind means, for the main admin's report. */
export const KIND_WORDS: Record<SuspiciousKind, string> = {
  staff_door: "هەوڵی کردنەوەی دەرگاکانی ئۆفیس (بەشی ستاف و ئادمین) — پۆرتاڵی ئاسایی هەرگیز ئەمە ناکات",
  unknown_procedure: "گەڕان بە دوای بەشی شاراوە — ناوی بەشی نەبوو تاقی کرایەوە",
  malformed_input: "ناردنی داتای تێکدراو بۆ چەندین شوێن — تاقیکردنەوەی کەلێن",
  runnable_upload: "هەوڵی ناردنی پەڕە یان کۆد (html/svg/js) لە جیاتی وێنە",
};

/** The refusals staff-only procedures answer with (server/middleware/auth.ts). */
export const STAFF_DOOR_MESSAGES = new Set([
  "Staff access required",
  "Admin access required",
  "Super admin access required",
  "Accountant access required",
]);

/** The report kept on the customer's row: the line crossed and what was seen. */
export interface SecurityHoldReport {
  kind: SuspiciousKind;
  summary: string;
  events: SuspiciousEvent[];
}
