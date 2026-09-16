/**
 * Wazn Express's WhatsApp chat — how every "ask us" in the system opens it.
 *
 * The owner's rule (2026-09-16): whichever WhatsApp button a customer taps,
 * it goes straight into Wazn's own chat, 07709183535, with a summary of the
 * request already written — who is asking, from which screen, about what — so
 * the office never has to ask "which parcel?".
 *
 * Straight in means a wa.me link opened by the tap itself. Not the phone's
 * share sheet: that asked the customer to pick WhatsApp, then to find Wazn
 * among their chats, and a request could end up anywhere.
 *
 * The number comes from constants/whatsapp — the one copy.
 */
import { TERMS_WHATSAPP_NUMBER } from "@/constants/whatsapp";
import { pickLang } from "@/lib/lang";

type Words = { ku: string; en: string; ar: string; zh: string };
type Text = Words | string;

/** One line of the summary: a label and its value, or a line of its own. */
export type WaznChatDetail = readonly [Text, string | number | null | undefined] | string | null | undefined | false;

export interface WaznChatRequest {
  language: string;
  /** What the customer wants, in one sentence. */
  intent: Text;
  /** Who is asking, when the portal knows. */
  customer?: { fullName?: string | null; customerCode?: string | null } | null;
  /** The screen or section they asked from. */
  section?: Text | null;
  /** The summary: tracking, status, amount — whatever the request is about. */
  details?: readonly WaznChatDetail[];
}

export const WAZN_CHAT_LABELS = {
  customer: { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" },
  section: { ku: "بەش", en: "Section", ar: "القسم", zh: "版块" },
} as const;

/** The general greeting, for a button that says no more than "WhatsApp". */
export const WAZN_CHAT_HELLO: Words = {
  ku: "سڵاو وەزن ئێکسپرێس، پرسیارێکم هەیە",
  en: "Hello Wazn Express, I have a question",
  ar: "مرحباً وزن اكسبريس، لدي سؤال",
  zh: "您好 Wazn Express，我有一个问题",
};

/** The public website's buttons: somebody who is not a customer yet. */
export const WAZN_CHAT_WEBSITE: Words = {
  ku: "سڵاو وەزن ئێکسپرێس، دەمەوێت زانیاری لەسەر ناردنی کاڵا لە چینەوە وەربگرم",
  en: "Hello Wazn Express, I'd like to know about shipping goods from China",
  ar: "مرحباً وزن اكسبريس، أودّ الاستفسار عن شحن البضائع من الصين",
  zh: "您好 Wazn Express，我想了解从中国发货的服务",
};

export const WAZN_CHAT_WEBSITE_SECTION: Words = { ku: "ماڵپەڕ", en: "Website", ar: "الموقع الإلكتروني", zh: "网站" };

/**
 * The message, one fact per line. Plain text only: emoji arrive as empty
 * boxes on some of the office's phones. Lines with nothing to say are left
 * out rather than sent as "Tracking: ".
 */
export function waznChatMessage(request: WaznChatRequest): string {
  const say = (text: Text) => (typeof text === "string" ? text : pickLang(request.language, text));
  const lines: string[] = [];
  const intent = say(request.intent).trim();
  if (intent) lines.push(intent);

  const name = request.customer?.fullName?.trim() ?? "";
  const code = request.customer?.customerCode?.trim() ?? "";
  if (name || code) {
    lines.push(`${say(WAZN_CHAT_LABELS.customer)}: ${[name, code ? `(${code})` : ""].filter(Boolean).join(" ")}`);
  }

  if (request.section) {
    const section = say(request.section).trim();
    if (section) lines.push(`${say(WAZN_CHAT_LABELS.section)}: ${section}`);
  }

  for (const detail of request.details ?? []) {
    if (!detail) continue;
    if (typeof detail === "string") {
      if (detail.trim()) lines.push(detail.trim());
      continue;
    }
    const [label, value] = detail;
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text) continue;
    lines.push(`${say(label)}: ${text}`);
  }
  return lines.join("\n");
}

/** The link into Wazn's chat, with the message written in. */
export function waznChatUrl(message?: string | null): string {
  const text = (message ?? "").trim();
  return `https://wa.me/${TERMS_WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Open the chat from inside a tap — for a button that cannot be a link. */
export function openWaznChat(message?: string | null): void {
  window.open(waznChatUrl(message), "_blank", "noopener,noreferrer");
}
