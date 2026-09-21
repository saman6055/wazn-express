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
  totalUsd: number;
}

const money = (amount: number): string => {
  const n = Number(amount);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
};

/**
 * The message that travels with the receipt.
 *
 * One paragraph: what it is, which box and how much, and a closing line that
 * promises nothing it cannot keep. Digits stay 0-9 in every language.
 */
export function receiptWhatsAppMessage(lang: ReceiptLanguage, facts: ReceiptMessageFacts): string {
  const code = facts.boxCode;
  const parcels = Math.max(0, Math.round(Number(facts.parcelCount) || 0));
  const total = money(facts.totalUsd);

  if (lang === "ar") {
    return (
      `السلام عليكم. هذا إيصال أغراضك الواصلة — الصندوق ${code}، ${parcels} طرد، ${total} دولار. ` +
      `إن شاء الله تصلكم في أنسب وقت. شكراً لثقتكم — وزن اكسبريس`
    );
  }
  if (lang === "en") {
    return (
      `Hello. Here is the receipt for your arrived goods — box ${code}, ${parcels} parcel(s), $${total}. ` +
      `It will reach you at the most suitable time, God willing. Thank you — Wazn Express`
    );
  }
  return (
    `سڵاوت لێبێت. ئەمە وەسڵی کەل و پەلە گەیشتووەکانتە — بۆکس ${code}، ${parcels} پاکەت، ${total} دۆلار. ` +
    `ان شاءاللە لە گونجاوترین کاتدا دەگاتە دەستتان. سوپاس بۆ متمانەت — وەزن ئێکسپرێس`
  );
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
