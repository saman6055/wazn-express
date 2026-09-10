/**
 * What a customer reads when something breaks on our side.
 *
 * The server sent the database's own words to whoever made the call —
 * `Failed query: insert into …`, and MySQL's reason under it. That is right
 * for the office, which needs the cause to fix it, and wrong for a customer,
 * who can do nothing with it and should never see our table names. Customers
 * get one calm sentence in their own language and a short reference; the
 * office keeps the full text with the same reference, so a customer's
 * WhatsApp screenshot leads straight to the log line.
 */

/** The reader's language, sent with every API call so errors can speak it. */
export const LANG_HEADER = "x-wazn-lang";

export type ErrorLang = "ku" | "ar" | "en" | "zh";

export function errorLang(value: unknown): ErrorLang {
  return value === "ar" || value === "en" || value === "zh" ? value : "ku";
}

export const SERVER_FAULT_TEXT: Record<ErrorLang, string> = {
  ku: "کێشەیەک لە لایەن ئێمەوە ڕوویدا. تکایە کەمێکی تر دووبارە هەوڵ بدەرەوە.",
  ar: "حدثت مشكلة من جهتنا. يرجى المحاولة مرة أخرى بعد قليل.",
  en: "Something went wrong on our side. Please try again in a moment.",
  zh: "我们这边出了问题，请稍后重试。",
};

export const INPUT_FAULT_TEXT: Record<ErrorLang, string> = {
  ku: "هەندێک لە زانیارییەکان دروست نین. تکایە پێیاندا بچۆرەوە و دووبارە بینێرە.",
  ar: "بعض المعلومات غير صحيحة. يرجى مراجعتها والإرسال مرة أخرى.",
  en: "Some of the details aren't right. Please check them and send again.",
  zh: "部分信息不正确，请检查后重新提交。",
};

export const NETWORK_FAULT_TEXT: Record<ErrorLang, string> = {
  ku: "پەیوەندی بە ئینتەرنێتەوە نییە. هێڵەکەت بپشکنە و دووبارە هەوڵ بدەرەوە.",
  ar: "لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى.",
  en: "No connection. Check your internet and try again.",
  zh: "网络连接中断，请检查网络后重试。",
};

/**
 * "Ref: 7F3A9C21" — Latin letters and digits, held left-to-right inside a
 * Kurdish or Arabic sentence so it never turns round.
 */
export function refLabel(ref: string): string {
  return `⁦Ref: ${ref}⁩`;
}
