/**
 * Sending a box receipt to the customer on WhatsApp (owner, 2026-09-21).
 *
 * "When you click, it goes straight into the customer's chat with the PDF —
 * only Send is left, and the admin does that. And a message in Kurdish or
 * Arabic, for the Kurdish and the Arab customers."
 *
 * Two things live here, so the office and the paper cannot disagree about
 * either: which language a customer is written to in, and what the message
 * says. Nothing here sends anything.
 *
 * The language comes from the customer's nationality, which is chosen when
 * the customer is created. There is no "language" column and none is being
 * added: nationality is what the owner already fills in, and the list it is
 * chosen from lives in settings, so the match is made on the stored id and
 * on the words themselves.
 *
 * The message deliberately promises no date. The owner, 2026-09-21: "do not
 * say the period — say something like: at the most suitable time".
 */

export type ReceiptLanguage = "ku" | "ar" | "en";

/** Words that mean "Kurd" and "Arab" in the three languages of the list. */
const KURDISH = ["kurdish", "kurd", "کورد", "كورد", "كردي", "kurdî"];
const ARAB = ["arab", "arabic", "عەرەب", "عرب", "عربي", "عەرەبی"];
/** Anybody written to in English: the list's own "foreign", and the obvious. */
const ENGLISH = ["foreign", "foreigner", "english", "بیانی", "ئینگلیزی", "أجنبي", "انگلیزی"];

const has = (value: string, words: string[]): boolean => words.some((w) => value.includes(w));

/**
 * Which language this customer is written to in.
 *
 * Kurdish is the answer when nothing says otherwise — including for the
 * Turkmen, Assyrian and Armenian of the list, who are written to in the
 * language of the place, not in one of their own we do not have.
 */
export function receiptLanguageFor(nationality?: string | null): ReceiptLanguage {
  const value = String(nationality ?? "").trim().toLowerCase();
  if (!value) return "ku";
  if (has(value, ARAB)) return "ar";
  if (has(value, ENGLISH)) return "en";
  if (has(value, KURDISH)) return "ku";
  return "ku";
}

export interface ReceiptMessageFacts {
  boxCode: string;
  parcelCount: number;
  /**
   * What the paper asks for in dollars - after the discount, what earlier
   * receipts paid and an advance taken off in dollars (owner, 2026-10-21:
   * the message said $183.03 where the paper said $116.93). Null when the
   * paper asks in dinars only (an advance taken off in dinars).
   */
  totalUsd: number | null;
  /**
   * The same figure in dinars, when the counter priced it in dinars before
   * sending (owner, 2026-09-22: "the amount worked out in dinars is not
   * written in the chat — it matters, put it there too"). Absent when no
   * rate was given, and then the message says dollars only.
   */
  totalIqd?: number | null;
  /** The customer's name, for the greeting (owner, 2026-10-21). */
  customerName?: string | null;
}

const money = (amount: number): string => {
  const n = Number(amount);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
};

/**
 * The message that travels with the receipt.
 *
 * Short and neat (owner, 2026-10-22: the polite paragraph was too long):
 * a greeting by first name - «سڵاو بەڕێز خەرمان، هیوادارین باش بیت» - that
 * the goods have arrived, the box on its own line, the very figure the paper
 * asks for on its own line, and a short thanks. It still promises no date.
 * Digits stay 0-9 in every language.
 */
export function receiptWhatsAppMessage(lang: ReceiptLanguage, facts: ReceiptMessageFacts): string {
  const code = facts.boxCode;
  const usd = facts.totalUsd === null ? null : money(facts.totalUsd);
  // Digits stay 0-9 and the thousands are grouped the way the receipt groups
  // them, so the chat and the paper read as the same figure.
  const iqd = Number(facts.totalIqd);
  const dinars = Number.isFinite(iqd) && iqd > 0 ? Math.round(iqd).toLocaleString("en-GB") : null;
  // The first name, as a person is greeted: «بەڕێز خەرمان», not the full name.
  const name = String(facts.customerName ?? "").trim().split(/\s+/)[0] ?? "";

  if (lang === "ar") {
    const amount = usd !== null
      ? (dinars ? `${usd} دولار (${dinars} دينار)` : `${usd} دولار`)
      : `${dinars ?? "0"} دينار`;
    return [
      `مرحباً${name ? ` حضرة ${name}` : ""}، نتمنى أن تكون بخير.`,
      "وصلت أغراضك.",
      `الصندوق: ${code}`,
      `المبلغ: ${amount}`,
      "شكراً لثقتك — وزن اكسبريس",
    ].join("\n");
  }
  if (lang === "en") {
    const amount = usd !== null
      ? (dinars ? `$${usd} (${dinars} IQD)` : `$${usd}`)
      : `${dinars ?? "0"} IQD`;
    return [
      `Hello${name ? ` ${name}` : ""}, we hope you are well.`,
      "Your goods have arrived.",
      `Box: ${code}`,
      `Amount: ${amount}`,
      "Thank you for your trust — Wazn Express",
    ].join("\n");
  }
  const amount = usd !== null
    ? (dinars ? `${usd} دۆلار (${dinars} دینار)` : `${usd} دۆلار`)
    : `${dinars ?? "0"} دینار`;
  return [
    `سڵاو${name ? ` بەڕێز ${name}` : ""}، هیوادارین باش بیت.`,
    "کەل و پەلەکانی بەڕێزت گەیشتوون.",
    `بۆکس: ${code}`,
    `بڕ: ${amount}`,
    "سوپاس بۆ متمانەت — وەزن ئێکسپرێس",
  ].join("\n");
}

/**
 * The message that travels with the box's parcel photos (owner, 2026-10-24):
 * «سلاو فلان کەس ئەمە وێنەی پاکەتە گەیشتوەکانە» - the customer sees what
 * is in the box. No money: that is the receipt's.
 */
export function boxPhotosWhatsAppMessage(lang: ReceiptLanguage, facts: { boxCode: string; parcelCount: number; customerName?: string | null }): string {
  const name = String(facts.customerName ?? "").trim().split(/\s+/)[0] ?? "";
  const n = Math.max(0, Math.round(Number(facts.parcelCount) || 0));
  if (lang === "ar") {
    return [
      `مرحباً${name ? ` حضرة ${name}` : ""}، هذه صور الطرود التي وصلت.`,
      `الصندوق: ${facts.boxCode} · ${n} طرد`,
      "شكراً لثقتك — وزن اكسبريس",
    ].join("\n");
  }
  if (lang === "en") {
    return [
      `Hello${name ? ` ${name}` : ""}, here are the photos of your parcels that arrived.`,
      `Box: ${facts.boxCode} · ${n} parcel(s)`,
      "Thank you for your trust — Wazn Express",
    ].join("\n");
  }
  return [
    `سڵاو${name ? ` بەڕێز ${name}` : ""}، ئەمە وێنەی ئەو پاکەتانەیە کە گەیشتوون.`,
    `بۆکس: ${facts.boxCode} · ${n} پاکەت`,
    "سوپاس بۆ متمانەت — وەزن ئێکسپرێس",
  ].join("\n");
}

/**
 * What the receipt message asks for: the paper's own last figure
 * (shared/receiptDinar). An advance in dollars leaves dollars due and their
 * dinars; one in dinars leaves dinars only; none, the total and its dinars.
 */
export function receiptMessageDue(
  leftToPayUsd: number,
  figures: { advance: { currency: "IQD" | "USD" } | null; dueUsd: number | null; dueIqd: number; totalIqd: number } | null,
): { usd: number | null; iqd: number | null } {
  if (!figures) return { usd: leftToPayUsd, iqd: null };
  if (figures.advance?.currency === "USD") return { usd: figures.dueUsd ?? leftToPayUsd, iqd: figures.dueIqd };
  if (figures.advance) return { usd: null, iqd: figures.dueIqd };
  return { usd: leftToPayUsd, iqd: figures.totalIqd };
}

/**
 * A phone number as WhatsApp wants it: digits only, with Iraq's country code.
 *
 * Numbers are kept in the local form — 0770…, sometimes with spaces or a
 * dash. wa.me takes none of that. Returns null when there is no number worth
 * opening a chat with.
 */
export function whatsappNumber(mobile?: string | null, countryCode = "964"): string | null {
  const digits = String(mobile ?? "").replace(/\D+/g, "");
  if (digits.length < 7) return null;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith(countryCode)) return digits;
  // A local number: 07709183535 → 9647709183535.
  return countryCode + digits.replace(/^0+/, "");
}

/** The chat, with the message already typed. */
export function whatsappChatUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
