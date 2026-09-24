/**
 * Every refusal says what went wrong and how to put it right.
 *
 * The owner, 2026-09-24, on seeing one warning written this way: "it is a
 * lovely idea — when something is wrong, the notice should say the reason and
 * the proper steps to solve it. Can you do that for the whole system? To me
 * it is a very clever idea."
 *
 * It is, and it is cheap: the code that refuses always knows why it refused
 * and what the person would have to do. Not saying so leaves them to guess,
 * or to ask somebody, or — worst — to find a way around the rule.
 *
 * The shape is one sentence of cause and a short numbered list of steps, in
 * whichever language the reader has. It is a plain string because that is
 * what a thrown error carries; the alert window prints the newlines
 * (SystemAlert renders the message with whitespace-pre-line), so the steps
 * arrive as steps rather than as one paragraph.
 *
 * Keep the steps to what the reader can actually do, in the order they would
 * do it, and name the screen or the button. "Contact the administrator" is
 * not a step; "open box BOX-1042 and take the parcel out of it" is.
 */

export type FixLanguage = "ku" | "en" | "ar" | "zh";

const HEADING: Record<FixLanguage, string> = {
  ku: "چۆن چارەسەری بکەیت:",
  en: "How to fix it:",
  ar: "كيف تحلّها:",
  zh: "如何解决：",
};

/**
 * One refusal, written out: the cause, then the steps.
 *
 * Steps that are empty are dropped, so a caller may build the list with
 * conditions in it without worrying about blanks.
 */
export function withFix(cause: string, steps: readonly (string | null | undefined)[], lang: FixLanguage = "ku"): string {
  const list = steps.map((s) => (s ?? "").trim()).filter(Boolean);
  const head = (cause ?? "").trim();
  if (list.length === 0) return head;
  const numbered = list.map((step, i) => `${i + 1}. ${step}`).join("\n");
  return `${head}\n\n${HEADING[lang]}\n${numbered}`;
}

/**
 * A record the screen just named and the server cannot find.
 *
 * It is the commonest refusal in the system and the emptiest: "box not
 * found" tells somebody looking straight at the box's code that it is not
 * there. Two things are almost always true — the list they clicked from is
 * older than the database, or somebody deleted the record — and both have a
 * step.
 *
 * `bin` is for the records the recycle bin keeps (boxes, parcels, customers,
 * batches, orders); leave it off for the ones it does not.
 */
export function vanishedFix(
  what: string,
  opts?: { bin?: boolean; also?: readonly (string | null | undefined)[]; lang?: FixLanguage },
): string {
  const lang = opts?.lang ?? "ku";
  const words = {
    ku: {
      cause: `${what} نەدۆزرایەوە — لەوانەیە سڕدرابێتەوە، یان ئەم لیستە لە داتابەیس کۆنتر بێت.`,
      refresh: "لاپەڕەکە نوێ بکەرەوە و دووبارە هەوڵ بدە",
      bin: "لە «سەبەتەی خاوێنکردنەوە» بگەڕێ — ئەگەر سڕدرابێتەوە لەوێیە و دەگەڕێتەوە",
    },
    en: {
      cause: `${what} was not found — it may have been deleted, or this list may be older than the database.`,
      refresh: "Refresh the page and try again",
      bin: "Look in the recycle bin — if it was deleted it is there, and can be restored",
    },
  } as const;
  const w = words[lang === "ku" ? "ku" : "en"];
  return withFix(w.cause, [w.refresh, opts?.bin ? w.bin : null, ...(opts?.also ?? [])], lang);
}

/**
 * Something inside the system failed, and the person at the screen did not
 * cause it and cannot repair it.
 *
 * "Contact the administrator" is not a step — but copying the report and
 * sending it is, because every failure in this system carries one on a
 * button (ErrorBoundary's buildErrorReport). So that is what it says.
 */
export function retryFix(cause: string, lang: FixLanguage = "ku"): string {
  const words = {
    ku: [
      "دووبارە هەوڵ بدەرەوە — زۆرجار جارێکی تر سەردەکەوێت",
      "ئەگەر دووبارە بووەوە، بە دوگمەی «کۆپیکردنی وردەکاری» ڕاپۆرتەکە کۆپی بکە و بۆ بەڕێوەبەری سیستەمی بنێرە",
      "تا ئەو کاتە ئەم کارە مەکە — لەوانەیە نیوەی ئەنجام درابێت",
    ],
    en: [
      "Try again — most of the time the second attempt works",
      "If it happens again, press \"Copy details\" and send the report to the administrator",
      "Until then leave this action alone — it may be half done",
    ],
  } as const;
  return withFix(cause, words[lang === "ku" ? "ku" : "en"], lang);
}

/** True when a message was written this way — the alert window tests for it. */
export function hasFix(message: string, lang: FixLanguage = "ku"): boolean {
  return typeof message === "string" && message.includes(HEADING[lang]);
}
