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

/** True when a message was written this way — the alert window tests for it. */
export function hasFix(message: string, lang: FixLanguage = "ku"): boolean {
  return typeof message === "string" && message.includes(HEADING[lang]);
}
